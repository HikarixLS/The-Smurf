import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiArrowLeft, FiSend, FiUsers, FiPlay, FiPause,
    FiCopy, FiCheck, FiEdit2, FiAlertCircle
} from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import { watchPartyService } from '@/services/firebase/watchPartyService';
import { movieService } from '@/services/api/movieService';
import { useAuth } from '@/services/firebase/AuthContext';
import {
    sendPlayerCommand, PlayerCommand,
    checkDrift, estimateHostTime,
    createHeartbeat, createBufferDetector,
} from '@/services/watchParty/syncEngine';
import styles from './WatchPartyRoom.module.css';

const WatchPartyRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // State
    const [room, setRoom] = useState(null);
    const [movie, setMovie] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [currentEpisode, setCurrentEpisode] = useState(0);
    const [editingName, setEditingName] = useState(false);
    const [nickname, setNickname] = useState('');
    const [syncStatus, setSyncStatus] = useState('waiting'); // waiting | synced | drifted | buffering
    const [localTime, setLocalTime] = useState(0);

    // Refs — "Flag" pattern to prevent infinite loops
    const iframeRef = useRef(null);
    const chatEndRef = useRef(null);
    const isSeeking = useRef(false);       // Flag: are we currently programmatically seeking?
    const isLocalAction = useRef(false);    // Flag: is this a local user action (not sync)?
    const lastSyncTime = useRef(0);         // Last synced host time
    const heartbeatRef = useRef(null);
    const bufferDetectorRef = useRef(createBufferDetector());
    const prevMembersRef = useRef(null);
    const roomRef = useRef(null);           // Latest room state (avoid stale closures)

    const session = watchPartyService.getSession();

    // Keep roomRef in sync
    useEffect(() => { roomRef.current = room; }, [room]);

    // ---- Init nickname ----
    useEffect(() => {
        if (user?.displayName) {
            setNickname(user.displayName);
            watchPartyService.updateName(user.displayName);
        } else {
            setNickname(session.name);
        }
    }, [user]);

    // ---- Join room & listen ----
    useEffect(() => {
        const displayName = user?.displayName || session.name;
        watchPartyService.updateName(displayName);
        watchPartyService.joinRoom(roomId).catch(console.error);
        watchPartyService.sendMessage(roomId, `📢 ${displayName} đã vào phòng`);

        // Listen to room updates
        const unsubRoom = watchPartyService.onRoomUpdate(roomId, (roomData) => {
            if (!roomData) {
                navigate('/watch-party');
                return;
            }

            // Detect join/leave via member count change
            if (prevMembersRef.current && roomData.members) {
                const prevKeys = new Set(Object.keys(prevMembersRef.current));
                const newKeys = Object.keys(roomData.members);
                newKeys.forEach(key => {
                    if (!prevKeys.has(key) && key !== session.id) {
                        // New member detected (their join message is sent by them)
                    }
                });
            }
            prevMembersRef.current = roomData.members || {};

            setRoom(roomData);
            if (roomData.playback?.episode !== undefined) {
                setCurrentEpisode(roomData.playback.episode);
            }
            setLoading(false);

            // Fetch movie if needed
            if (!movie && roomData.movieSlug) {
                movieService.getMovieDetail(roomData.movieSlug).then(res => {
                    if (res?.data?.item) setMovie(res.data.item);
                }).catch(() => { });
            }

            // ── Sync logic for non-host ──
            if (roomData.hostId !== session.id && roomData.playback && !isSeeking.current) {
                const estimated = estimateHostTime(
                    roomData.playback.currentTime || 0,
                    roomData.playback.updatedAt || Date.now(),
                    roomData.playback.isPlaying
                );

                const { needsSync, drift } = checkDrift(lastSyncTime.current, estimated);

                if (needsSync && iframeRef.current) {
                    isSeeking.current = true;
                    sendPlayerCommand(iframeRef.current, PlayerCommand.SEEK, estimated);
                    setTimeout(() => { isSeeking.current = false; }, 1000);
                    setSyncStatus('drifted');
                } else {
                    setSyncStatus('synced');
                }

                // Sync play/pause state
                if (iframeRef.current) {
                    if (roomData.playback.isPlaying) {
                        sendPlayerCommand(iframeRef.current, PlayerCommand.PLAY);
                    } else {
                        sendPlayerCommand(iframeRef.current, PlayerCommand.PAUSE);
                    }
                }
            }
        });

        const unsubMsgs = watchPartyService.onMessages(roomId, setMessages);

        return () => {
            unsubRoom();
            unsubMsgs();
            const name = user?.displayName || session.name;
            watchPartyService.sendMessage(roomId, `👋 ${name} đã rời phòng`);
            watchPartyService.leaveRoom(roomId);
        };
    }, [roomId]);

    // ---- postMessage listener — receive events from iframe ----
    useEffect(() => {
        const handleMessage = (e) => {
            const data = e.data;
            if (!data || data.type !== 'smurfSync') return;

            bufferDetectorRef.current.reportProgress(data.currentTime || 0);
            setLocalTime(data.currentTime || 0);
            lastSyncTime.current = data.currentTime || 0;

            const currentRoom = roomRef.current;
            const isHost = currentRoom?.hostId === session.id;

            switch (data.event) {
                case 'heartbeat':
                case 'timeUpdate':
                    // Host broadcasts their time to Firebase
                    if (isHost && !isSeeking.current) {
                        watchPartyService.syncPlayback(roomId, {
                            currentTime: data.currentTime,
                            isPlaying: !data.paused,
                        });
                    }

                    // Check buffering
                    if (data.buffering) {
                        setSyncStatus('buffering');
                        if (isHost) {
                            watchPartyService.syncPlayback(roomId, { isPlaying: false });
                            watchPartyService.sendMessage(roomId, '⏳ Đang đợi tải video...');
                        }
                    }
                    break;

                case 'play':
                    if (isHost && !isLocalAction.current) {
                        watchPartyService.syncPlayback(roomId, {
                            currentTime: data.currentTime,
                            isPlaying: true,
                        });
                        watchPartyService.updateRoomStatus(roomId, 'playing');
                    }
                    break;

                case 'pause':
                    if (isHost && !isLocalAction.current) {
                        watchPartyService.syncPlayback(roomId, {
                            currentTime: data.currentTime,
                            isPlaying: false,
                        });
                        watchPartyService.updateRoomStatus(roomId, 'paused');
                    }
                    break;

                case 'seeked':
                    if (isHost && !isSeeking.current) {
                        watchPartyService.syncPlayback(roomId, {
                            currentTime: data.currentTime,
                        });
                    }
                    break;

                case 'buffering':
                    setSyncStatus('buffering');
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [roomId]);

    // ---- Heartbeat: periodically request time from iframe ----
    useEffect(() => {
        heartbeatRef.current = createHeartbeat(() => {
            if (iframeRef.current) {
                sendPlayerCommand(iframeRef.current, PlayerCommand.GET_TIME);
            }

            // Check buffer detector
            if (bufferDetectorRef.current.check()) {
                setSyncStatus('buffering');
            }
        });

        heartbeatRef.current.start();
        return () => heartbeatRef.current?.stop();
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ---- Handlers ----

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await watchPartyService.sendMessage(roomId, newMessage.trim());
        setNewMessage('');
    };

    const handlePlayPause = useCallback(async () => {
        if (room?.hostId !== session.id) return;

        isLocalAction.current = true;
        const isPlaying = room?.playback?.isPlaying;

        if (iframeRef.current) {
            if (isPlaying) {
                sendPlayerCommand(iframeRef.current, PlayerCommand.PAUSE);
            } else {
                sendPlayerCommand(iframeRef.current, PlayerCommand.PLAY);
            }
        }

        await watchPartyService.syncPlayback(roomId, {
            isPlaying: !isPlaying,
            currentTime: localTime,
        });
        await watchPartyService.updateRoomStatus(roomId, !isPlaying ? 'playing' : 'paused');
        await watchPartyService.sendMessage(roomId,
            !isPlaying ? '▶️ Host đã bấm phát' : '⏸️ Host đã tạm dừng'
        );

        setTimeout(() => { isLocalAction.current = false; }, 500);
    }, [room, localTime, roomId]);

    const handleEpisodeChange = async (epIdx) => {
        if (room?.hostId !== session.id) return;
        setCurrentEpisode(epIdx);
        await watchPartyService.syncPlayback(roomId, {
            episode: epIdx,
            currentTime: 0,
            isPlaying: true,
        });
        await watchPartyService.updateRoomStatus(roomId, 'playing');
        await watchPartyService.sendMessage(roomId, `📺 Đã chuyển sang tập ${epIdx + 1}`);
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLeave = () => navigate('/watch-party');

    const handleSaveNickname = () => {
        if (nickname.trim()) {
            watchPartyService.updateName(nickname.trim());
            setEditingName(false);
            if (room) watchPartyService.joinRoom(roomId);
        }
    };

    // ---- Derived ----
    const isHost = room?.hostId === session.id;
    const members = room?.members ? Object.values(room.members) : [];
    const episodes = movie?.episodes?.[0]?.server_data || [];
    const currentVideo = episodes[currentEpisode];
    const videoSrc = currentVideo?.link_embed || '';

    // Sync status indicator
    const syncIndicator = {
        waiting: { icon: '⏳', text: 'Đang chờ', color: '#fbbf24' },
        synced: { icon: '✅', text: 'Đồng bộ', color: '#22c55e' },
        drifted: { icon: '🔄', text: 'Đang đồng bộ...', color: '#667eea' },
        buffering: { icon: '⏳', text: 'Đang tải...', color: '#ef4444' },
    }[syncStatus] || {};

    if (loading) return (
        <div className={styles.loadingPage}>
            <div className={styles.spinner} />
            <p>Đang tham gia phòng...</p>
        </div>
    );

    return (
        <>
            <Header />
            <main className={styles.room}>
                <div className={styles.layout}>
                    <div className={styles.mainContent}>
                        {/* Top bar */}
                        <div className={styles.topBar}>
                            <button className={styles.backBtn} onClick={handleLeave}>
                                <FiArrowLeft /> Rời phòng
                            </button>
                            <div className={styles.roomTitle}>
                                <span className={`${styles.statusDot} ${styles[room?.status || 'waiting']}`} />
                                {room?.movieOriginName || room?.movieName}
                            </div>
                            <div className={styles.syncIndicator} style={{ color: syncIndicator.color }}>
                                {syncIndicator.icon} {syncIndicator.text}
                            </div>
                            <button className={styles.copyBtn} onClick={handleCopyLink}>
                                {copied ? <><FiCheck /> Đã copy</> : <><FiCopy /> Chia sẻ</>}
                            </button>
                        </div>

                        {/* Video player */}
                        <div className={styles.playerWrapper}>
                            {videoSrc ? (
                                <iframe
                                    ref={iframeRef}
                                    src={videoSrc}
                                    className={styles.player}
                                    allowFullScreen
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                />
                            ) : (
                                <div className={styles.noVideo}>
                                    <FiPlay size={48} />
                                    <p>{movie ? 'Đang tải video...' : 'Đang tải phim...'}</p>
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className={styles.controls}>
                            <div className={styles.controlLeft}>
                                {isHost ? (
                                    <button className={styles.controlBtn} onClick={handlePlayPause}>
                                        {room?.playback?.isPlaying ? <FiPause /> : <FiPlay />}
                                        {room?.playback?.isPlaying ? ' Tạm dừng' : ' Phát'}
                                    </button>
                                ) : (
                                    <span className={styles.syncLabel}>
                                        🔄 Đồng bộ với {room?.hostName}
                                    </span>
                                )}
                                {syncStatus === 'buffering' && (
                                    <span className={styles.bufferWarning}>
                                        <FiAlertCircle size={14} /> Đang đợi tải video...
                                    </span>
                                )}
                            </div>
                            <div className={styles.controlRight}>
                                <span className={styles.memberCount}>
                                    <FiUsers /> {members.length} người
                                </span>
                            </div>
                        </div>

                        {/* Episodes */}
                        {episodes.length > 1 && (
                            <div className={styles.episodeSection}>
                                <h4>Tập phim</h4>
                                <div className={styles.episodeGrid}>
                                    {episodes.map((ep, i) => (
                                        <button
                                            key={i}
                                            className={`${styles.episodeBtn} ${i === currentEpisode ? styles.epActive : ''}`}
                                            onClick={() => handleEpisodeChange(i)}
                                            disabled={!isHost}
                                        >
                                            {ep.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat sidebar */}
                    <div className={styles.chatSidebar}>
                        <div className={styles.chatHeader}>
                            <h3>Chat ({messages.length})</h3>
                            <div className={styles.membersList}>
                                {members.map((m, i) => (
                                    <span
                                        key={i}
                                        className={`${styles.memberTag} ${m.isHost ? styles.hostTag : ''}`}
                                        title={m.name}
                                    >
                                        {m.name.charAt(0)}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Nickname editor */}
                        <div className={styles.nicknameBar}>
                            {editingName ? (
                                <div className={styles.nicknameEdit}>
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={e => setNickname(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                                        maxLength={20}
                                        autoFocus
                                        className={styles.nicknameInput}
                                    />
                                    <button onClick={handleSaveNickname} className={styles.nicknameSave}>
                                        <FiCheck size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.nicknameDisplay}>
                                    <span>Bạn: <strong>{nickname}</strong></span>
                                    <button onClick={() => setEditingName(true)} className={styles.nicknameEditBtn}>
                                        <FiEdit2 size={12} /> Đổi tên
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className={styles.chatMessages}>
                            {messages.length === 0 ? (
                                <div className={styles.chatEmpty}>
                                    <p>Chưa có tin nhắn. Hãy bắt đầu trò chuyện!</p>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isSystem = msg.text.startsWith('📢') || msg.text.startsWith('👋') || msg.text.startsWith('▶️') || msg.text.startsWith('⏸️') || msg.text.startsWith('📺') || msg.text.startsWith('⏳');
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`${styles.message} ${msg.userId === session.id ? styles.myMessage : ''} ${isSystem ? styles.systemMessage : ''}`}
                                        >
                                            {!isSystem && <span className={styles.msgUser}>{msg.userName}</span>}
                                            <p className={styles.msgText}>{msg.text}</p>
                                            <span className={styles.msgTime}>
                                                {new Date(msg.timestamp).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <form className={styles.chatInput} onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Nhập tin nhắn..."
                                maxLength={500}
                            />
                            <button type="submit" disabled={!newMessage.trim()}>
                                <FiSend />
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </>
    );
};

export default WatchPartyRoom;
