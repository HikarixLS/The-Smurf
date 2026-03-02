import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import {
    FiArrowLeft, FiSend, FiUsers, FiPlay, FiPause,
    FiCopy, FiCheck, FiEdit2, FiAlertCircle,
    FiVolume2, FiVolumeX, FiMaximize, FiSkipForward
} from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import { watchPartyService } from '@/services/firebase/watchPartyService';
import { movieService } from '@/services/api/movieService';
import { useAuth } from '@/services/firebase/AuthContext';
import styles from './WatchPartyRoom.module.css';

const SYNC_THRESHOLD = 3; // seconds — max drift before force-seek
const HEARTBEAT_MS = 2500; // host broadcasts time every 2.5s

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
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [videoReady, setVideoReady] = useState(false);

    // Refs — "Flag" pattern to prevent infinite loops
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const chatEndRef = useRef(null);
    const isSyncing = useRef(false);         // Flag: currently programmatic seeking/playing
    const heartbeatRef = useRef(null);
    const prevMembersRef = useRef(null);
    const roomRef = useRef(null);

    const session = watchPartyService.getSession();
    const isHost = room?.hostId === session.id;

    // Keep roomRef in sync (avoids stale closures)
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

        const unsubRoom = watchPartyService.onRoomUpdate(roomId, (roomData) => {
            if (!roomData) { navigate('/watch-party'); return; }

            // Detect member changes
            if (prevMembersRef.current && roomData.members) {
                const prevKeys = new Set(Object.keys(prevMembersRef.current));
                Object.keys(roomData.members).forEach(key => {
                    if (!prevKeys.has(key) && key !== session.id) {
                        // New member joined — their join message is sent by them
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

            // ── Sync for non-host ──
            if (roomData.hostId !== session.id && roomData.playback && videoRef.current) {
                syncToHost(roomData.playback);
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

    // ---- HLS player setup ----
    const [hlsFailed, setHlsFailed] = useState(false);

    useEffect(() => {
        const episodes = movie?.episodes?.[0]?.server_data || [];
        const ep = episodes[currentEpisode];
        if (!ep?.link_m3u8 || !videoRef.current || hlsFailed) return;

        // Reset ready state
        setVideoReady(false);

        // Cancelled flag to prevent stale callbacks after cleanup (React StrictMode protection)
        let cancelled = false;
        let mediaRecoveryAttempts = 0;
        const MAX_RECOVERY = 3;

        // Destroy previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const video = videoRef.current;
        // Start muted to comply with browser autoplay policy
        video.muted = true;
        setIsMuted(true);

        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                enableWorker: true,
                xhrSetup: (xhr) => {
                    xhr.withCredentials = false;
                },
            });

            hls.loadSource(ep.link_m3u8);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (cancelled) return;
                console.log('[WatchParty] HLS manifest parsed, ready to play');
                setVideoReady(true);

                // Auto-play if the room state says we should be playing
                const pb = roomRef.current?.playback;
                if (pb?.isPlaying) {
                    video.play().catch(() => {
                        // Fallback: play muted to comply with autoplay policy
                        video.muted = true;
                        setIsMuted(true);
                        video.play().catch(() => { });
                    });
                }
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (cancelled) return;

                // Only log fatal errors to reduce console noise
                if (data.fatal) {
                    console.warn('[WatchParty] HLS fatal error:', data.type, data.details);
                    switch (data.type) {
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            mediaRecoveryAttempts++;
                            if (mediaRecoveryAttempts <= MAX_RECOVERY) {
                                console.log(`[WatchParty] Recovering media error (attempt ${mediaRecoveryAttempts}/${MAX_RECOVERY})`);
                                hls.recoverMediaError();
                            } else {
                                console.warn('[WatchParty] Max media recovery attempts reached, giving up');
                                // Don't destroy — let HLS continue with what it has
                            }
                            break;
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            setTimeout(() => {
                                if (hlsRef.current && !cancelled) {
                                    hls.startLoad();
                                }
                            }, 2000);
                            setTimeout(() => {
                                if (!cancelled && video.currentTime === 0 && video.paused) {
                                    hls.destroy();
                                    hlsRef.current = null;
                                    setHlsFailed(true);
                                }
                            }, 5000);
                            break;
                        default:
                            hls.destroy();
                            hlsRef.current = null;
                            setHlsFailed(true);
                            break;
                    }
                }
                // Non-fatal errors (bufferStalledError, bufferSeekOverHole, etc.)
                // are handled internally by HLS.js — no action needed
            });

            hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS
            video.src = ep.link_m3u8;
            video.addEventListener('loadedmetadata', () => {
                if (cancelled) return;
                setVideoReady(true);
                video.play().catch(() => { });
            }, { once: true });
        } else {
            setHlsFailed(true);
        }

        return () => {
            cancelled = true;
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [movie, currentEpisode, hlsFailed]);

    // ---- Host heartbeat: broadcast time to Firebase ----
    useEffect(() => {
        if (!room || room.hostId !== session.id) return;

        heartbeatRef.current = setInterval(() => {
            if (!videoRef.current || isSyncing.current) return;
            watchPartyService.syncPlayback(roomId, {
                currentTime: videoRef.current.currentTime,
                isPlaying: !videoRef.current.paused,
                episode: currentEpisode,
            });
        }, HEARTBEAT_MS);

        return () => clearInterval(heartbeatRef.current);
    }, [room, currentEpisode, roomId]);

    // ---- Sync non-host to host's playback state ----
    const syncToHost = useCallback((playback) => {
        const video = videoRef.current;
        // Only sync non-host users; skip if already syncing
        if (!video || isSyncing.current || roomRef.current?.hostId === session.id) return;

        const estimatedHostTime = estimateTime(
            playback.currentTime || 0,
            playback.updatedAt || Date.now(),
            playback.isPlaying
        );

        const drift = Math.abs(video.currentTime - estimatedHostTime);

        isSyncing.current = true;

        // Sync time if drifted
        if (drift > SYNC_THRESHOLD) {
            video.currentTime = estimatedHostTime;
        }

        // Sync play/pause state
        if (playback.isPlaying && video.paused) {
            video.play().catch(() => { });
            setIsPlaying(true);
        } else if (!playback.isPlaying && !video.paused) {
            video.pause();
            setIsPlaying(false);
        }

        setTimeout(() => { isSyncing.current = false; }, 1000);
    }, [session.id]);

    // Estimate host's current time accounting for network delay
    function estimateTime(hostTime, hostTimestamp, hostIsPlaying) {
        if (!hostIsPlaying) return hostTime;
        const elapsed = (Date.now() - hostTimestamp) / 1000;
        return hostTime + Math.min(elapsed, 10); // cap at 10s to avoid huge jumps
    }

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ---- Video event handlers ----
    const onTimeUpdate = () => {
        if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
    };
    const onDurationChange = () => {
        if (videoRef.current) setDuration(videoRef.current.duration);
    };
    const onPlay = () => {
        // Only update state if not currently executing a sync (prevents feedback loop)
        if (!isSyncing.current) {
            setIsPlaying(true);
            // If non-host video started playing without host command, pause it immediately
            if (roomRef.current && roomRef.current.hostId !== session.id) {
                const pb = roomRef.current?.playback;
                if (pb && !pb.isPlaying) {
                    videoRef.current?.pause();
                }
            }
        }
    };
    const onPause = () => {
        if (!isSyncing.current) {
            setIsPlaying(false);
        }
    };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);

    // ---- Handlers ----
    const handlePlayPause = useCallback(() => {
        const video = videoRef.current;
        if (!video || !videoReady) return;

        isSyncing.current = true;

        if (video.paused) {
            video.play().catch((err) => {
                console.warn('[WatchParty] Play failed:', err.message);
                // If autoplay fails, try playing muted
                video.muted = true;
                setIsMuted(true);
                video.play().catch(() => { });
            });
            if (isHost) {
                watchPartyService.syncPlayback(roomId, {
                    currentTime: video.currentTime,
                    isPlaying: true,
                    episode: currentEpisode,
                });
                watchPartyService.updateRoomStatus(roomId, 'playing');
                watchPartyService.sendMessage(roomId, '▶️ Host đã bấm phát');
            }
        } else {
            video.pause();
            if (isHost) {
                watchPartyService.syncPlayback(roomId, {
                    currentTime: video.currentTime,
                    isPlaying: false,
                    episode: currentEpisode,
                });
                watchPartyService.updateRoomStatus(roomId, 'paused');
                watchPartyService.sendMessage(roomId, '⏸️ Host đã tạm dừng');
            }
        }

        setTimeout(() => { isSyncing.current = false; }, 1000);
    }, [room, currentEpisode, roomId, videoReady, isHost]);

    const handleSeek = (e) => {
        const video = videoRef.current;
        if (!video || room?.hostId !== session.id) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const newTime = ratio * duration;
        video.currentTime = newTime;

        watchPartyService.syncPlayback(roomId, {
            currentTime: newTime,
            isPlaying: !video.paused,
            episode: currentEpisode,
        });
    };

    const handleToggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
        }
    };

    const handleFullscreen = () => {
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
            } else if (videoRef.current.webkitRequestFullscreen) {
                videoRef.current.webkitRequestFullscreen();
            }
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await watchPartyService.sendMessage(roomId, newMessage.trim());
        setNewMessage('');
    };

    const handleEpisodeChange = async (epIdx) => {
        if (room?.hostId !== session.id) return;
        setCurrentEpisode(epIdx);
        await watchPartyService.syncPlayback(roomId, {
            episode: epIdx,
            currentTime: 0,
            isPlaying: false,
        });
        await watchPartyService.updateRoomStatus(roomId, 'waiting');
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

    // Format time
    const fmt = (s) => {
        if (!s || isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // ---- Derived ----
    const members = room?.members ? Object.values(room.members) : [];
    const episodes = movie?.episodes?.[0]?.server_data || [];
    const currentVideo = episodes[currentEpisode];
    const hasHls = !!currentVideo?.link_m3u8 && !hlsFailed;

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
                            <button className={styles.copyBtn} onClick={handleCopyLink}>
                                {copied ? <><FiCheck /> Đã copy</> : <><FiCopy /> Chia sẻ</>}
                            </button>
                        </div>

                        {/* Video player */}
                        <div className={styles.playerWrapper}>
                            {hasHls ? (
                                <video
                                    ref={videoRef}
                                    className={styles.player}
                                    onTimeUpdate={onTimeUpdate}
                                    onDurationChange={onDurationChange}
                                    onPlay={onPlay}
                                    onPause={onPause}
                                    onWaiting={onWaiting}
                                    onCanPlay={onCanPlay}
                                    playsInline
                                />
                            ) : currentVideo?.link_embed ? (
                                <iframe
                                    src={currentVideo.link_embed}
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

                            {/* Buffering overlay */}
                            {isBuffering && hasHls && (
                                <div className={styles.bufferOverlay}>
                                    <div className={styles.spinner} />
                                </div>
                            )}
                        </div>

                        {/* Custom Controls — only for HLS player */}
                        {hasHls && (
                            <div className={styles.controls}>
                                <div className={styles.controlLeft}>
                                    <button
                                        className={styles.controlBtn}
                                        onClick={isHost ? handlePlayPause : undefined}
                                        disabled={!videoReady || !isHost}
                                        title={!isHost ? 'Chỉ host mới có thể điều khiển' : ''}
                                    >
                                        {isPlaying ? <FiPause /> : <FiPlay />}
                                        {!videoReady ? ' Đang tải...' : isPlaying ? ' Tạm dừng' : ' Phát'}
                                    </button>
                                    {!isHost && (
                                        <span className={styles.syncLabel}>
                                            🔄 Đang đồng bộ với {room?.hostName}
                                        </span>
                                    )}
                                    <button className={styles.iconBtn} onClick={handleToggleMute}>
                                        {isMuted ? <FiVolumeX /> : <FiVolume2 />}
                                    </button>
                                    <span className={styles.timeDisplay}>
                                        {fmt(currentTime)} / {fmt(duration)}
                                    </span>
                                </div>
                                <div className={styles.controlRight}>
                                    <span className={styles.memberCount}>
                                        <FiUsers /> {members.length}
                                    </span>
                                    <button className={styles.iconBtn} onClick={handleFullscreen}>
                                        <FiMaximize />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Seek bar — only for HLS */}
                        {hasHls && (
                            <div className={styles.seekBar} onClick={handleSeek}>
                                <div
                                    className={styles.seekProgress}
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                            </div>
                        )}

                        {/* Fallback controls for iframe */}
                        {!hasHls && currentVideo?.link_embed && (
                            <div className={styles.controls}>
                                <div className={styles.controlLeft}>
                                    <span className={styles.syncLabel}>📺 Dùng điều khiển trong player</span>
                                </div>
                                <div className={styles.controlRight}>
                                    <span className={styles.memberCount}>
                                        <FiUsers /> {members.length}
                                    </span>
                                </div>
                            </div>
                        )}

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
                                    const isSystem = /^(📢|👋|▶️|⏸️|📺|⏳)/.test(msg.text);
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
