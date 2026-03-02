import {
    ref, push, set, get, update, remove, onValue, off,
    onDisconnect,
    serverTimestamp, query, orderByChild, limitToLast
} from 'firebase/database';
import { database, isFirebaseConfigured, getCurrentUser } from './config';

const ROOMS_REF = 'watchPartyRooms';
const MESSAGES_REF = 'watchPartyMessages';

// Generate a random display name
const generateName = () => {
    const adjectives = ['Vui', 'Hào', 'Dũng', 'Xinh', 'Cool', 'Hot', 'Cute'];
    const nouns = ['Smurf', 'Gấu', 'Mèo', 'Cáo', 'Thỏ', 'Rồng', 'Hổ'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}${Math.floor(Math.random() * 100)}`;
};

// Get or create persistent user session (stored in localStorage)
const getSession = () => {
    let session = localStorage.getItem('smurf_wp_session');
    if (session) return JSON.parse(session);
    const newSession = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: generateName(),
        createdAt: Date.now(),
    };
    localStorage.setItem('smurf_wp_session', JSON.stringify(newSession));
    return newSession;
};

const updateName = (newName) => {
    const session = getSession();
    session.name = newName;
    localStorage.setItem('smurf_wp_session', JSON.stringify(session));
};

export const watchPartyService = {
    isAvailable: () => isFirebaseConfigured() && database !== null,

    getSession,

    updateName: (name) => {
        const session = getSession();
        session.name = name;
        localStorage.setItem('smurf_wp_session', JSON.stringify(session));
        return session;
    },

    // Create a new Watch Party room
    createRoom: async ({ movieSlug, movieName, movieThumb }) => {
        if (!database) throw new Error('Firebase chưa được cấu hình');
        const session = getSession();

        const roomRef = push(ref(database, ROOMS_REF));
        const roomData = {
            id: roomRef.key,
            movieSlug,
            movieName,
            movieThumb: movieThumb || '',
            hostId: session.id,
            hostName: session.name,
            status: 'waiting',
            createdAt: Date.now(),
            playback: {
                currentTime: 0,
                isPlaying: false,
                episode: 0,
                server: 0,
                updatedAt: Date.now(),
            },
            members: {
                [session.id]: {
                    id: session.id,
                    name: session.name,
                    joinedAt: Date.now(),
                    isHost: true,
                    isBuffering: false,
                },
            },
            viewerCount: 1,
        };

        await set(roomRef, roomData);

        // Register onDisconnect for host's own member entry
        const hostMemberRef = ref(database, `${ROOMS_REF}/${roomRef.key}/members/${session.id}`);
        onDisconnect(hostMemberRef).remove();

        return roomData;
    },

    // Join a room
    joinRoom: async (roomId) => {
        if (!database) throw new Error('Firebase chưa được cấu hình');
        const session = getSession();
        const memberRef = ref(database, `${ROOMS_REF}/${roomId}/members/${session.id}`);

        // Register: auto-remove this member if the connection drops
        onDisconnect(memberRef).remove();

        await set(memberRef, {
            id: session.id,
            name: session.name,
            joinedAt: Date.now(),
            isHost: false,
            isBuffering: false,
        });

        // Recalculate viewerCount from actual members
        const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
        const snapshot = await get(roomRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const memberCount = data.members ? Object.keys(data.members).length : 1;
            await update(roomRef, { viewerCount: memberCount });
        }

        return session;
    },

    // Leave a room — with Host Migration
    leaveRoom: async (roomId) => {
        if (!database) return;
        const session = getSession();
        const memberRef = ref(database, `${ROOMS_REF}/${roomId}/members/${session.id}`);

        // Cancel the onDisconnect we registered (so it doesn't fire again later)
        await onDisconnect(memberRef).cancel();
        await remove(memberRef);

        const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
        const snapshot = await get(roomRef);
        if (!snapshot.exists()) return;

        const data = snapshot.val();
        const members = data.members ? Object.entries(data.members) : [];
        const memberCount = members.length;

        if (memberCount === 0) {
            // Last person left → delete room + messages
            await remove(roomRef);
            await remove(ref(database, `${MESSAGES_REF}/${roomId}`));
            return;
        }

        // Host migration: if the leaving user was host, promote oldest member
        if (data.hostId === session.id) {
            const sorted = members
                .map(([, m]) => m)
                .filter(m => m.id && m.id !== session.id)
                .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

            if (sorted.length > 0) {
                const newHost = sorted[0];
                await update(roomRef, {
                    hostId: newHost.id,
                    hostName: newHost.name,
                });
                await update(
                    ref(database, `${ROOMS_REF}/${roomId}/members/${newHost.id}`),
                    { isHost: true }
                );
            }
        }

        await update(roomRef, { viewerCount: Math.max(0, memberCount) });
    },

    // Get all rooms (snapshot)
    getRooms: async () => {
        if (!database) return [];
        const roomsRef = ref(database, ROOMS_REF);
        const snapshot = await get(roomsRef);
        if (!snapshot.exists()) return [];

        const rooms = [];
        snapshot.forEach((child) => rooms.push({ ...child.val(), id: child.key }));
        return rooms.sort((a, b) => b.createdAt - a.createdAt);
    },

    // Subscribe to rooms list
    onRoomsUpdate: (callback) => {
        if (!database) return () => { };
        const roomsRef = ref(database, ROOMS_REF);
        onValue(roomsRef, (snapshot) => {
            const rooms = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => rooms.push({ ...child.val(), id: child.key }));
            }
            callback(rooms.sort((a, b) => b.createdAt - a.createdAt));
        });
        return () => off(roomsRef);
    },

    // Subscribe to a specific room
    onRoomUpdate: (roomId, callback) => {
        if (!database) return () => { };
        const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
        onValue(roomRef, (snapshot) => {
            callback(snapshot.exists() ? snapshot.val() : null);
        });
        return () => off(roomRef);
    },

    // Update playback state (Host only — guards in WatchPartyRoom.jsx)
    syncPlayback: async (roomId, playbackData) => {
        if (!database) return;
        await update(ref(database, `${ROOMS_REF}/${roomId}/playback`), {
            ...playbackData,
            updatedAt: Date.now(),
        });
    },

    // Self-promote to Host (called by oldest viewer when no host is found)
    promoteToHost: async (roomId) => {
        if (!database) return;
        const session = getSession();
        const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
        await update(roomRef, { hostId: session.id, hostName: session.name });
        await update(ref(database, `${ROOMS_REF}/${roomId}/members/${session.id}`), { isHost: true });
    },

    // Update room status
    updateRoomStatus: async (roomId, status) => {
        if (!database) return;
        await update(ref(database, `${ROOMS_REF}/${roomId}`), { status });
    },

    // Report local buffering state — viewers call this on waiting/canplay events
    reportBuffering: async (roomId, isBuffering) => {
        if (!database) return;
        const session = getSession();
        const memberRef = ref(database, `${ROOMS_REF}/${roomId}/members/${session.id}`);
        await update(memberRef, { isBuffering });
    },

    // Send a chat message
    sendMessage: async (roomId, text) => {
        if (!database) return;
        const session = getSession();
        const msgRef = push(ref(database, `${MESSAGES_REF}/${roomId}`));
        await set(msgRef, {
            userId: session.id,
            userName: session.name,
            text,
            timestamp: Date.now(),
        });
    },

    // Subscribe to chat messages (last 100)
    onMessages: (roomId, callback) => {
        if (!database) return () => { };
        const msgsRef = query(
            ref(database, `${MESSAGES_REF}/${roomId}`),
            orderByChild('timestamp'),
            limitToLast(100)
        );
        onValue(msgsRef, (snapshot) => {
            const messages = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => messages.push({ ...child.val(), id: child.key }));
            }
            callback(messages);
        });
        return () => off(msgsRef);
    },

    // Delete a room (Host only)
    deleteRoom: async (roomId) => {
        if (!database) return;
        await remove(ref(database, `${ROOMS_REF}/${roomId}`));
        await remove(ref(database, `${MESSAGES_REF}/${roomId}`));
    },
};

export default watchPartyService;
