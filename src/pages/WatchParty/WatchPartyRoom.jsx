import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiArrowLeft, FiSend, FiUsers, FiPlay, FiPause, FiLogOut,
    FiCopy, FiCheck, FiEdit2
} from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import { watchPartyService } from '@/services/firebase/watchPartyService';
import { movieService } from '@/services/api/movieService';
import { useAuth } from '@/services/firebase/AuthContext';
import styles from './WatchPartyRoom.module.css';

const WatchPartyRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [room, setRoom] = useState(null);
    const [movie, setMovie] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [currentEpisode, setCurrentEpisode] = useState(0);
    const [editingName, setEditingName] = useState(false);
    const [nickname, setNickname] = useState('');
    const chatEndRef = useRef(null);
    const iframeRef = useRef(null);
    const prevMembersRef = useRef(null);
    const session = watchPartyService.getSession();

    // Initialize nickname from Google account or session
    useEffect(() => {
        if (user?.displayName) {
            setNickname(user.displayName);
            // Update session name with Google name
            watchPartyService.updateName(user.displayName);
        } else {
            setNickname(session.name);
        }
    }, [user]);

    useEffect(() => {
        // Join room with display name
        const displayName = user?.displayName || session.name;
        watchPartyService.updateName(displayName);
        watchPartyService.joinRoom(roomId).catch(err => {
            console.error('Join error:', err);
        });

        // Send join notification
        watchPartyService.sendMessage(roomId, `📢 ${displayName} đã vào phòng`);

        // Listen to room updates
        const unsubRoom = watchPartyService.onRoomUpdate(roomId, (roomData) => {
            if (!roomData) {
                navigate('/watch-party');
                return;
            }

            // Detect new members joining (notifications)
            if (prevMembersRef.current && roomData.members) {
                const prevKeys = Object.keys(prevMembersRef.current);
                const newKeys = Object.keys(roomData.members);
                // Find newly joined members
                newKeys.forEach(key => {
                    if (!prevKeys.includes(key) && key !== session.id) {
                        const newMember = roomData.members[key];
                        // The join message is already sent by the joiner
                    }
                });
            }
            prevMembersRef.current = roomData.members || {};

            setRoom(roomData);
            if (roomData.playback?.episode !== undefined) {
                setCurrentEpisode(roomData.playback.episode);
            }
            setLoading(false);

            // Fetch movie data if not loaded
            if (!movie && roomData.movieSlug) {
                movieService.getMovieDetail(roomData.movieSlug).then(res => {
                    if (res?.data?.item) setMovie(res.data.item);
                }).catch(() => { });
            }
        });

        // Listen to messages
        const unsubMsgs = watchPartyService.onMessages(roomId, (msgs) => {
            setMessages(msgs);
        });

        return () => {
            unsubRoom();
            unsubMsgs();
            // Send leave notification
            const name = user?.displayName || session.name;
            watchPartyService.sendMessage(roomId, `👋 ${name} đã rời phòng`);
            watchPartyService.leaveRoom(roomId);
        };
    }, [roomId]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await watchPartyService.sendMessage(roomId, newMessage.trim());
        setNewMessage('');
    };

    const handlePlayPause = async () => {
        if (room?.hostId !== session.id) return;
        const isPlaying = room?.playback?.isPlaying;
        await watchPartyService.syncPlayback(roomId, {
            isPlaying: !isPlaying,
        });
        await watchPartyService.updateRoomStatus(roomId, !isPlaying ? 'playing' : 'paused');

        // Send notification
        await watchPartyService.sendMessage(roomId,
            !isPlaying ? '▶️ Host đã bấm phát' : '⏸️ Host đã tạm dừng'
        );
    };

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

    const handleLeave = async () => {
        navigate('/watch-party');
    };

    const handleSaveNickname = () => {
        if (nickname.trim()) {
            watchPartyService.updateName(nickname.trim());
            setEditingName(false);
            // Update member name in room
            if (room) {
                watchPartyService.joinRoom(roomId);
            }
        }
    };

    const isHost = room?.hostId === session.id;
    const members = room?.members ? Object.values(room.members) : [];
    const episodes = movie?.episodes?.[0]?.server_data || [];
    const currentVideo = episodes[currentEpisode];

    // Determine video source - prefer m3u8, fallback to embed
    const videoSrc = currentVideo?.link_m3u8 || currentVideo?.link_embed || '';
    const isEmbed = !currentVideo?.link_m3u8 && currentVideo?.link_embed;

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
                    {/* Main content */}
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
                            <button className={styles.copyBtn} onClick={handleCopyLink}>
                                {copied ? <><FiCheck /> Đã copy</> : <><FiCopy /> Chia sẻ link</>}
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
                                {isHost && (
                                    <button className={styles.controlBtn} onClick={handlePlayPause}>
                                        {room?.playback?.isPlaying ? <FiPause /> : <FiPlay />}
                                        {room?.playback?.isPlaying ? 'Tạm dừng' : 'Phát'}
                                    </button>
                                )}
                                {!isHost && (
                                    <span className={styles.syncLabel}>
                                        🔄 Đồng bộ với {room?.hostName}
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
                                    const isSystem = msg.text.startsWith('📢') || msg.text.startsWith('👋') || msg.text.startsWith('▶️') || msg.text.startsWith('⏸️') || msg.text.startsWith('📺');
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
