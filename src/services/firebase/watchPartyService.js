import {
    ref, push, set, get, update, remove, onValue, off,
    serverTimestamp, query, orderByChild, limitToLast
} from 'firebase/database';
import { database, isFirebaseConfigured, getCurrentUser } from './config';

const ROOMS_REF = 'watchPartyRooms';
const MESSAGES_REF = 'watchPartyMessages';

// Generate a display name
const generateName = () => {
    const adjectives = ['Vui', 'Hào', 'Dũng', 'Xinh', 'Cool', 'Hot', 'Cute'];
    const nouns = ['Smurf', 'Gấu', 'Mèo', 'Cáo', 'Thỏ', 'Rồng', 'Hổ'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}${Math.floor(Math.random() * 100)}`;
};

// Get or create user session
const getSession = () => {
    let session = localStorage.getItem('smurf_wp_session');
    if (session) {
        return JSON.parse(session);
    }
    const newSession = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: generateName(),
        createdAt: Date.now(),
    };
    localStorage.setItem('smurf_wp_session', JSON.stringify(newSession));
    return newSession;
};

export const watchPartyService = {
    // Check if service is available
    isAvailable: () => isFirebaseConfigured() && database !== null,

    // Get user session
    getSession,

    // Update display name
    updateName: (name) => {
        const session = getSession();
        session.name = name;
        localStorage.setItem('smurf_wp_session', JSON.stringify(session));
        return session;
    },

    // Create a new watch party room
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
            status: 'waiting', // waiting, playing, paused, ended
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
                    name: session.name,
                    joinedAt: Date.now(),
                    isHost: true,
                }
            },
            viewerCount: 1,
        };

        await set(roomRef, roomData);
        return roomData;
    },

    // Join a room
    joinRoom: async (roomId) => {
        if (!database) throw new Error('Firebase chưa được cấu hình');
        const session = getSession();

        const memberRef = ref(database, `${ROOMS_REF}/${roomId}/members/${session.id}`);
        await set(memberRef, {
            name: session.name,
            joinedAt: Date.now(),
            isHost: false,
        });

        // Increment viewer count
        const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
        const snapshot = await get(roomRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const memberCount = data.members ? Object.keys(data.members).length : 1;
            await update(roomRef, { viewerCount: memberCount + 1 });
        }

        return session;
    },

    // Leave a room
    leaveRoom: async (roomId) => {
        if (!database) return;
        const session = getSession();

        const memberRef = ref(database, `${ROOMS_REF}/${roomId}/members/${session.id}`);
        await remove(memberRef);

        // Decrement viewer count
        const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
        const snapshot = await get(roomRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const memberCount = data.members ? Object.keys(data.members).length : 0;
            await update(roomRef, { viewerCount: Math.max(0, memberCount) });

            // If no members left, remove room
            if (memberCount === 0) {
                await remove(roomRef);
                await remove(ref(database, `${MESSAGES_REF}/${roomId}`));
            }
        }
    },

    // Get all rooms
    getRooms: async () => {
        if (!database) return [];
        const roomsRef = ref(database, ROOMS_REF);
        const snapshot = await get(roomsRef);
        if (!snapshot.exists()) return [];

        const rooms = [];
        snapshot.forEach((child) => {
            rooms.push({ ...child.val(), id: child.key });
        });
        return rooms.sort((a, b) => b.createdAt - a.createdAt);
    },

    // Listen to rooms list
    onRoomsUpdate: (callback) => {
        if (!database) return () => { };
        const roomsRef = ref(database, ROOMS_REF);
        onValue(roomsRef, (snapshot) => {
            const rooms = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    rooms.push({ ...child.val(), id: child.key });
                });
            }
            callback(rooms.sort((a, b) => b.createdAt - a.createdAt));
        });
        return () => off(roomsRef);
    },

    // Listen to a specific room
    onRoomUpdate: (roomId, callback) => {
        if (!database) return () => { };
        const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
        onValue(roomRef, (snapshot) => {
            callback(snapshot.exists() ? snapshot.val() : null);
        });
        return () => off(roomRef);
    },

    // Update playback state (host only)
    syncPlayback: async (roomId, playbackData) => {
        if (!database) return;
        const playbackRef = ref(database, `${ROOMS_REF}/${roomId}/playback`);
        await update(playbackRef, {
            ...playbackData,
            updatedAt: Date.now(),
        });
    },

    // Update room status
    updateRoomStatus: async (roomId, status) => {
        if (!database) return;
        await update(ref(database, `${ROOMS_REF}/${roomId}`), { status });
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

    // Listen to chat messages
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
                snapshot.forEach((child) => {
                    messages.push({ ...child.val(), id: child.key });
                });
            }
            callback(messages);
        });
        return () => off(msgsRef);
    },

    // Delete a room (host only)
    deleteRoom: async (roomId) => {
        if (!database) return;
        await remove(ref(database, `${ROOMS_REF}/${roomId}`));
        await remove(ref(database, `${MESSAGES_REF}/${roomId}`));
    },
};

export default watchPartyService;
