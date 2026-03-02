import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import {
    FiArrowLeft, FiSend, FiUsers, FiPlay, FiPause,
    FiCopy, FiCheck, FiEdit2,
    FiVolume2, FiVolumeX, FiMaximize,
} from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import { watchPartyService } from '@/services/firebase/watchPartyService';
import { movieService } from '@/services/api/movieService';
import { useAuth } from '@/services/firebase/AuthContext';
import styles from './WatchPartyRoom.module.css';

// Sync constants
const SYNC_THRESHOLD = 3;    // seconds — max drift before force-seek
const HEARTBEAT_MS = 8000; // host broadcasts position every 8s (fallback only)
// play/pause/seek are synced immediately via direct calls

const WatchPartyRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // ── State ──
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
    const [hlsFailed, setHlsFailed] = useState(false);
    // Buffering-wait UI: set when host detects a viewer is buffering
    const [waitingFor, setWaitingFor] = useState(null); // string: viewer name, or null

    // ── Refs (Flag pattern — no React re-render needed) ──
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const chatEndRef = useRef(null);
    const isSyncing = useRef(false);  // true while doing programmatic seek/play
    const heartbeatRef = useRef(null);
    const prevMembersRef = useRef(null);
    const roomRef = useRef(null);   // always current room (avoids stale closures)

    const session = watchPartyService.getSession();
    // Derive isHost from live room state
    const isHost = room?.hostId === session.id;

    // Keep roomRef current without extra renders
    useEffect(() => { roomRef.current = room; }, [room]);

    // ── Init nickname ──
    useEffect(() => {
        const name = user?.displayName || session.name;
        setNickname(name);
        watchPartyService.updateName(name);
    }, [user]);

    // ── Join room & subscribe ──
    useEffect(() => {
        const displayName = user?.displayName || session.name;
        watchPartyService.updateName(displayName);
        watchPartyService.joinRoom(roomId).catch(console.error);
        watchPartyService.sendMessage(roomId, `📢 ${displayName} đã vào phòng`);

        const unsubRoom = watchPartyService.onRoomUpdate(roomId, (roomData) => {
            if (!roomData) { navigate('/watch-party'); return; }

            prevMembersRef.current = roomData.members || {};
            setRoom(roomData);

            if (roomData.playback?.episode !== undefined) {
                setCurrentEpisode(roomData.playback.episode);
            }
            setLoading(false);

            // Fetch movie detail once
            if (!movie && roomData.movieSlug) {
                movieService.getMovieDetail(roomData.movieSlug).then(res => {
                    if (res?.data?.item) setMovie(res.data.item);
                }).catch(() => { });
            }

            // ── Viewer: sync to host playback ──
            if (roomData.hostId !== session.id && roomData.playback && videoRef.current) {
                syncToHost(roomData.playback);
            }

            // ── Host: detect if any viewer is buffering ──
            if (roomData.hostId === session.id && roomData.members) {
                const bufferingMember = Object.values(roomData.members).find(
                    m => m.id !== session.id && m.isBuffering
                );
                if (bufferingMember) {
                    // Auto-pause host video
                    if (videoRef.current && !videoRef.current.paused) {
                        isSyncing.current = true;
                        videoRef.current.pause();
                        setTimeout(() => { isSyncing.current = false; }, 1000);
                    }
                    setWaitingFor(bufferingMember.name);
                } else {
                    // All viewers ready — resume if we were waiting
                    if (waitingFor !== null) {
                        setWaitingFor(null);
                        if (videoRef.current && videoRef.current.paused && isPlaying) {
                            isSyncing.current = true;
                            videoRef.current.play().catch(() => { });
                            setTimeout(() => { isSyncing.current = false; }, 1000);
                        }
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
    }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── HLS player setup ──
    useEffect(() => {
        const episodes = movie?.episodes?.[0]?.server_data || [];
        const ep = episodes[currentEpisode];
        if (!ep?.link_m3u8 || !videoRef.current || hlsFailed) return;

        setVideoReady(false);
        let cancelled = false;
        let mediaRecoveryAttempts = 0;
        const MAX_RECOVERY = 3;

        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

        const video = videoRef.current;
        video.muted = true;
        setIsMuted(true);

        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                enableWorker: true,
                xhrSetup: (xhr) => { xhr.withCredentials = false; },
            });

            hls.loadSource(ep.link_m3u8);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (cancelled) return;
                setVideoReady(true);
                const pb = roomRef.current?.playback;
                if (pb?.isPlaying) {
                    video.play().catch(() => {
                        video.muted = true;
                        setIsMuted(true);
                        video.play().catch(() => { });
                    });
                }
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (cancelled || !data.fatal) return;
                switch (data.type) {
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        mediaRecoveryAttempts++;
                        if (mediaRecoveryAttempts <= MAX_RECOVERY) hls.recoverMediaError();
                        break;
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        setTimeout(() => { if (hlsRef.current && !cancelled) hls.startLoad(); }, 2000);
                        setTimeout(() => {
                            if (!cancelled && video.currentTime === 0 && video.paused) {
                                hls.destroy(); hlsRef.current = null; setHlsFailed(true);
                            }
                        }, 5000);
                        break;
                    default:
                        hls.destroy(); hlsRef.current = null; setHlsFailed(true);
                }
            });

            hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
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
            if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        };
    }, [movie, currentEpisode, hlsFailed]);

    // ── Host heartbeat — 8s fallback drift correction ──
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

    // ── Sync viewer to host ──
    const syncToHost = useCallback((playback) => {
        const video = videoRef.current;
        if (!video || isSyncing.current || roomRef.current?.hostId === session.id) return;

        // Estimate host's current time accounting for network latency
        const estimated = (() => {
            if (!playback.isPlaying || !playback.updatedAt) return playback.currentTime || 0;
            const elapsed = (Date.now() - playback.updatedAt) / 1000;
            return (playback.currentTime || 0) + Math.min(elapsed, 10);
        })();

        const drift = Math.abs(video.currentTime - estimated);

        isSyncing.current = true;

        if (drift > SYNC_THRESHOLD) video.currentTime = estimated;

        if (playback.isPlaying && video.paused) {
            video.play().catch(() => { });
            setIsPlaying(true);
        } else if (!playback.isPlaying && !video.paused) {
            video.pause();
            setIsPlaying(false);
        }

        setTimeout(() => { isSyncing.current = false; }, 1000);
    }, [session.id]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Video event handlers ──
    // CRITICAL: Non-host events must NEVER write to Firebase
    const onTimeUpdate = () => {
        if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
    };
    const onDurationChange = () => {
        if (videoRef.current) setDuration(videoRef.current.duration);
    };
    const onPlay = () => {
        if (isSyncing.current) return; // programmatic — skip
        setIsPlaying(true);
        // Non-host: if room says paused, force-pause ourselves (don't write Firebase)
        if (roomRef.current && roomRef.current.hostId !== session.id) {
            if (!roomRef.current.playback?.isPlaying) {
                videoRef.current?.pause();
            }
        }
        // Note: host fires syncPlayback in handlePlayPause, NOT here
    };
    const onPause = () => {
        if (isSyncing.current) return;
        setIsPlaying(false);
        // Host does NOT sync here — syncPlayback is fired in handlePlayPause
    };
    const onWaiting = () => {
        setIsBuffering(true);
        // Report buffering to Firebase so host can pause
        watchPartyService.reportBuffering(roomId, true);
    };
    const onCanPlay = () => {
        setIsBuffering(false);
        // Report ready
        watchPartyService.reportBuffering(roomId, false);
    };

    // ── Controls ──

    // Only host can play/pause
    const handlePlayPause = useCallback(() => {
        const video = videoRef.current;
        if (!video || !videoReady || !isHost) return;

        isSyncing.current = true;

        if (video.paused) {
            video.play().catch(() => {
                video.muted = true; setIsMuted(true);
                video.play().catch(() => { });
            });
            watchPartyService.syncPlayback(roomId, {
                currentTime: video.currentTime, isPlaying: true, episode: currentEpisode,
            });
            watchPartyService.updateRoomStatus(roomId, 'playing');
            watchPartyService.sendMessage(roomId, '▶️ Host đã bấm phát');
        } else {
            video.pause();
            watchPartyService.syncPlayback(roomId, {
                currentTime: video.currentTime, isPlaying: false, episode: currentEpisode,
            });
            watchPartyService.updateRoomStatus(roomId, 'paused');
            watchPartyService.sendMessage(roomId, '⏸️ Host đã tạm dừng');
        }

        setTimeout(() => { isSyncing.current = false; }, 1000);
    }, [room, currentEpisode, roomId, videoReady, isHost]);

    // Only host can seek
    const handleSeek = (e) => {
        const video = videoRef.current;
        if (!video || !isHost) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const newTime = ((e.clientX - rect.left) / rect.width) * duration;
        video.currentTime = newTime;
        watchPartyService.syncPlayback(roomId, {
            currentTime: newTime, isPlaying: !video.paused, episode: currentEpisode,
        });
    };

    const handleToggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(videoRef.current.muted);
    };

    const handleFullscreen = () => {
        const v = videoRef.current;
        if (!v) return;
        (v.requestFullscreen || v.webkitRequestFullscreen)?.call(v);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await watchPartyService.sendMessage(roomId, newMessage.trim());
        setNewMessage('');
    };

    const handleEpisodeChange = async (epIdx) => {
        if (!isHost) return;
        setCurrentEpisode(epIdx);
        await watchPartyService.syncPlayback(roomId, { episode: epIdx, currentTime: 0, isPlaying: false });
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
        if (!nickname.trim()) return;
        watchPartyService.updateName(nickname.trim());
        setEditingName(false);
        if (room) watchPartyService.joinRoom(roomId);
    };

    // ── Helpers ──
    const fmt = (s) => {
        if (!s || isNaN(s)) return '0:00';
        return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    };

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

                            {/* Host waiting overlay — shown while a viewer is buffering */}
                            {isHost && waitingFor && (
                                <div className={styles.bufferOverlay}>
                                    <div className={styles.spinner} />
                                    <p style={{ marginTop: 12, color: '#fff', fontSize: 14 }}>
                                        ⏳ Đang chờ <strong>{waitingFor}</strong> tải phim...
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Controls — HLS only */}
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
                                            🔄 Đồng bộ với {room?.hostName}
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
                                    <span className={styles.memberCount}><FiUsers /> {members.length}</span>
                                    <button className={styles.iconBtn} onClick={handleFullscreen}><FiMaximize /></button>
                                </div>
                            </div>
                        )}

                        {/* Seek bar — HLS only, host only */}
                        {hasHls && (
                            <div
                                className={styles.seekBar}
                                onClick={isHost ? handleSeek : undefined}
                                style={{ cursor: isHost ? 'pointer' : 'default' }}
                                title={!isHost ? 'Chỉ host mới có thể tua phim' : ''}
                            >
                                <div
                                    className={styles.seekProgress}
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                            </div>
                        )}

                        {/* Fallback notice for iframe embed */}
                        {!hasHls && currentVideo?.link_embed && (
                            <div className={styles.controls}>
                                <div className={styles.controlLeft}>
                                    <span className={styles.syncLabel}>
                                        📺 Dùng điều khiển trong player — đồng bộ thủ công
                                    </span>
                                </div>
                                <div className={styles.controlRight}>
                                    <span className={styles.memberCount}><FiUsers /> {members.length}</span>
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
                                        className={`${styles.memberTag} ${m.isHost ? styles.hostTag : ''} ${m.isBuffering ? styles.bufferingTag : ''}`}
                                        title={`${m.name}${m.isBuffering ? ' (đang load...)' : ''}`}
                                    >
                                        {m.name?.charAt(0) || '?'}
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
                            <button type="submit" disabled={!newMessage.trim()}><FiSend /></button>
                        </form>
                    </div>
                </div>
            </main>
        </>
    );
};

export default WatchPartyRoom;
