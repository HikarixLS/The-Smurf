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

const SYNC_THRESHOLD = 3;    // seconds — max drift before force-seek
const HEARTBEAT_MS = 8000; // host broadcasts position every 8s (fallback only)

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
    const [volume, setVolume] = useState(0.8);   // 0–1
    const [showVolume, setShowVolume] = useState(false);  // volume slider popup
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [hlsFailed, setHlsFailed] = useState(false);
    const [waitingFor, setWaitingFor] = useState(null);  // buffering viewer name

    // ── Refs ──
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const chatEndRef = useRef(null);
    const isSyncing = useRef(false);
    const heartbeatRef = useRef(null);
    const prevMembersRef = useRef(null);
    const roomRef = useRef(null);
    const movieLoadedRef = useRef(false);
    const promotingRef = useRef(false);   // prevent duplicate promoteToHost calls

    const session = watchPartyService.getSession();
    const isHost = room?.hostId === session.id;

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

            // ── Detect member join/leave ──
            if (prevMembersRef.current) {
                const prev = new Set(Object.keys(prevMembersRef.current));
                const current = roomData.members ? Object.keys(roomData.members) : [];
                current.forEach(key => {
                    if (!prev.has(key) && key !== session.id) {
                        // Someone new joined — already announced by themselves via sendMessage
                        // We just let the system message show
                    }
                });
                prev.forEach(key => {
                    if (!current.includes(key) && key !== session.id) {
                        const left = prevMembersRef.current[key];
                        if (left?.name) {
                            watchPartyService.sendMessage(roomId, `👋 ${left.name} đã rời phòng`);
                        }
                    }
                });
            }
            prevMembersRef.current = roomData.members || {};
            setRoom(roomData);

            if (roomData.playback?.episode !== undefined) {
                setCurrentEpisode(roomData.playback.episode);
            }
            setLoading(false);

            // ── Auto Host Promotion (host closed tab / network drop) ──
            if (roomData.members) {
                const memberList = Object.values(roomData.members);
                const currentHost = memberList.find(m => m.isHost);

                if (!currentHost && memberList.length > 0 && !promotingRef.current) {
                    const oldest = [...memberList].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];
                    if (oldest.id === session.id) {
                        promotingRef.current = true;
                        watchPartyService.promoteToHost(roomId)
                            .then(() => watchPartyService.sendMessage(roomId, `👑 ${session.name} đã tự động trở thành Host mới`))
                            .finally(() => { promotingRef.current = false; });
                    }
                }
            }

            // ── Fetch movie detail ONCE (use ref, not state — stale closure guard) ──
            if (!movieLoadedRef.current && roomData.movieSlug) {
                movieLoadedRef.current = true;
                movieService.getMovieDetail(roomData.movieSlug).then(res => {
                    if (res?.data?.item) setMovie(res.data.item);
                    else movieLoadedRef.current = false;
                }).catch(() => { movieLoadedRef.current = false; });
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
                    if (videoRef.current && !videoRef.current.paused) {
                        isSyncing.current = true;
                        videoRef.current.pause();
                        setTimeout(() => { isSyncing.current = false; }, 1000);
                    }
                    setWaitingFor(bufferingMember.name);
                } else {
                    setWaitingFor(prev => {
                        if (prev !== null) {
                            if (videoRef.current && videoRef.current.paused) {
                                isSyncing.current = true;
                                videoRef.current.play().catch(() => { });
                                setTimeout(() => { isSyncing.current = false; }, 1000);
                            }
                        }
                        return null;
                    });
                }
            }
        });

        const unsubMsgs = watchPartyService.onMessages(roomId, setMessages);

        return () => {
            unsubRoom();
            unsubMsgs();
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
                    video.play().catch(() => { video.muted = true; setIsMuted(true); video.play().catch(() => { }); });
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

    // ── Host heartbeat ──
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

    // Close volume popup on outside click
    useEffect(() => {
        if (!showVolume) return;
        const handler = () => setShowVolume(false);
        const timer = setTimeout(() => document.addEventListener('click', handler), 100);
        return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
    }, [showVolume]);

    // ── Video event handlers ──
    const onTimeUpdate = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
    const onDurationChange = () => { if (videoRef.current) setDuration(videoRef.current.duration); };
    const onPlay = () => {
        if (isSyncing.current) return;
        setIsPlaying(true);
        // Non-host: if room says paused, force-pause (don't write Firebase)
        if (roomRef.current && roomRef.current.hostId !== session.id) {
            if (!roomRef.current.playback?.isPlaying) videoRef.current?.pause();
        }
    };
    const onPause = () => { if (!isSyncing.current) setIsPlaying(false); };
    const onWaiting = () => {
        setIsBuffering(true);
        watchPartyService.reportBuffering(roomId, true);
    };
    const onCanPlay = () => {
        setIsBuffering(false);
        watchPartyService.reportBuffering(roomId, false);
    };

    // ── Controls ──
    const handlePlayPause = useCallback(() => {
        const video = videoRef.current;
        if (!video || !videoReady || !isHost) return;
        isSyncing.current = true;

        if (video.paused) {
            video.play().catch(() => { video.muted = true; setIsMuted(true); video.play().catch(() => { }); });
            watchPartyService.syncPlayback(roomId, { currentTime: video.currentTime, isPlaying: true, episode: currentEpisode });
            watchPartyService.updateRoomStatus(roomId, 'playing');
            watchPartyService.sendMessage(roomId, '▶️ Host đã bấm phát');
        } else {
            video.pause();
            watchPartyService.syncPlayback(roomId, { currentTime: video.currentTime, isPlaying: false, episode: currentEpisode });
            watchPartyService.updateRoomStatus(roomId, 'paused');
            watchPartyService.sendMessage(roomId, '⏸️ Host đã tạm dừng');
        }

        setTimeout(() => { isSyncing.current = false; }, 1000);
    }, [room, currentEpisode, roomId, videoReady, isHost]);

    const handleSeek = (e) => {
        const video = videoRef.current;
        if (!video || !isHost) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const newTime = ((e.clientX - rect.left) / rect.width) * duration;
        video.currentTime = newTime;
        watchPartyService.syncPlayback(roomId, { currentTime: newTime, isPlaying: !video.paused, episode: currentEpisode });
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
            setIsMuted(val === 0);
        }
    };

    const handleToggleMute = (e) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        const newMuted = !videoRef.current.muted;
        videoRef.current.muted = newMuted;
        setIsMuted(newMuted);
        if (!newMuted && volume === 0) {
            setVolume(0.5);
            videoRef.current.volume = 0.5;
        }
    };

    const handleFullscreen = () => {
        const v = videoRef.current;
        if (!v) return;
        (v.requestFullscreen || v.webkitRequestFullscreen)?.call(v);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text) return;
        setNewMessage(''); // clear immediately for better UX
        await watchPartyService.sendMessage(roomId, text);
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
                            <div className={styles.topBarRight}>
                                <span className={styles.viewerBadge}>
                                    <FiUsers size={13} /> {members.length} người xem
                                </span>
                                <button className={styles.copyBtn} onClick={handleCopyLink}>
                                    {copied ? <><FiCheck /> Đã copy</> : <><FiCopy /> Chia sẻ</>}
                                </button>
                            </div>
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

                            {isBuffering && hasHls && (
                                <div className={styles.bufferOverlay}>
                                    <div className={styles.spinner} />
                                </div>
                            )}

                            {isHost && waitingFor && (
                                <div className={styles.bufferOverlay}>
                                    <div className={styles.spinner} />
                                    <p className={styles.waitingText}>
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
                                        <span className={styles.syncLabel}>🔄 Đồng bộ với {room?.hostName}</span>
                                    )}

                                    {/* Volume control with slider */}
                                    <div className={styles.volumeWrap} onClick={e => e.stopPropagation()}>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={(e) => { handleToggleMute(e); setShowVolume(v => !v); }}
                                            title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
                                        >
                                            {isMuted || volume === 0 ? <FiVolumeX /> : <FiVolume2 />}
                                        </button>
                                        {showVolume && (
                                            <div className={styles.volumePopup}>
                                                <input
                                                    type="range"
                                                    min="0" max="1" step="0.05"
                                                    value={isMuted ? 0 : volume}
                                                    onChange={handleVolumeChange}
                                                    className={styles.volumeSlider}
                                                    orient="vertical"
                                                />
                                                <span className={styles.volumeLabel}>
                                                    {Math.round((isMuted ? 0 : volume) * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <span className={styles.timeDisplay}>{fmt(currentTime)} / {fmt(duration)}</span>
                                </div>
                                <div className={styles.controlRight}>
                                    <button className={styles.iconBtn} onClick={handleFullscreen}><FiMaximize /></button>
                                </div>
                            </div>
                        )}

                        {/* Seek bar — HLS only */}
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

                        {/* Iframe fallback notice */}
                        {!hasHls && currentVideo?.link_embed && (
                            <div className={styles.controls}>
                                <span className={styles.syncLabel}>
                                    📺 Dùng điều khiển trong player — đồng bộ thủ công
                                </span>
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
                            <h3>Chat</h3>
                            <div className={styles.membersList}>
                                {members.map((m, i) => (
                                    <span
                                        key={m.id || i}
                                        className={`${styles.memberTag} ${m.isHost ? styles.hostTag : ''} ${m.isBuffering ? styles.bufferingTag : ''}`}
                                        title={`${m.name}${m.isHost ? ' (Host)' : ''}${m.isBuffering ? ' — đang load...' : ''}`}
                                    >
                                        {m.name?.charAt(0)?.toUpperCase() || '?'}
                                    </span>
                                ))}
                                <span className={styles.memberCountBadge}>{members.length}</span>
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
                                    <span>Bạn: <strong>{nickname}</strong>{isHost ? ' 👑' : ''}</span>
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
                                    const isSystem = /^(📢|👋|▶️|⏸️|📺|⏳|👑)/.test(msg.text);
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
                                autoComplete="off"
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
