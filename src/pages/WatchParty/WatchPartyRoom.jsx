import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import {
    FiArrowLeft, FiUsers, FiPlay, FiPause,
    FiCopy, FiCheck, FiEdit2,
    FiVolume2, FiVolumeX, FiMaximize, FiSquare,
} from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import { watchPartyService } from '@/services/firebase/watchPartyService';
import { movieService } from '@/services/api/movieService';
import { useAuth } from '@/services/firebase/AuthContext';
import {
    SYNC_THRESHOLD_SECONDS,
    HEARTBEAT_INTERVAL_MS,
    estimateHostTime,
    allMembersReady,
} from '@/services/watchParty/syncEngine';
import { WPNotify } from '@/services/watchParty/watchPartyNotification';
import styles from './WatchPartyRoom.module.css';

const WatchPartyRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // ── State ──
    const [room, setRoom] = useState(null);
    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [currentEpisode, setCurrentEpisode] = useState(0);
    const [editingName, setEditingName] = useState(false);
    const [nickname, setNickname] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    // Restore persisted volume from localStorage, default 0.8
    const [volume, setVolume] = useState(() => {
        const saved = parseFloat(localStorage.getItem('smurf_volume'));
        return isNaN(saved) ? 0.8 : Math.min(1, Math.max(0, saved));
    });
    const [showVolume, setShowVolume] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [hlsFailed, setHlsFailed] = useState(false);
    const [waitingFor, setWaitingFor] = useState(null);   // buffering viewer name(s)

    /** Playback speed: 0.75 / 1 / 1.25 / 1.5 / 2 */
    const [playbackRate, setPlaybackRate] = useState(1);

    // ── Refs ──
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const isSyncing = useRef(false);          // prevents sync feedback loops
    const heartbeatRef = useRef(null);
    const prevMembersRef = useRef(null);
    const roomRef = useRef(null);             // stale-closure guard for room state
    const movieLoadedRef = useRef(false);
    const promotingRef = useRef(false);
    const wasPlayingBeforeBarrierRef = useRef(false);

    const session = watchPartyService.getSession();
    const isHost = room?.hostId === session.id;

    useEffect(() => { roomRef.current = room; }, [room]);


    // ── Init nickname ──
    useEffect(() => {
        const name = user?.displayName || session.name;
        setNickname(name);
        watchPartyService.updateName(name);
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps


    // ── Join room & subscribe ──
    useEffect(() => {
        const displayName = user?.displayName || session.name;
        watchPartyService.updateName(displayName);

        watchPartyService.joinRoom(roomId).catch(console.error);

        const unsubRoom = watchPartyService.onRoomUpdate(roomId, (roomData) => {
            if (!roomData) { navigate('/watch-party'); return; }

            const currentMembers = roomData.members || {};

            // ── Detect member join/leave for notifications ──
            if (prevMembersRef.current !== null) {
                const prevIds = new Set(Object.keys(prevMembersRef.current));
                const currIds = new Set(Object.keys(currentMembers));

                // Joined
                for (const id of currIds) {
                    if (!prevIds.has(id) && id !== session.id) {
                        WPNotify.memberJoined(currentMembers[id]?.name || 'Ai đó');
                    }
                }
                // Left
                for (const id of prevIds) {
                    if (!currIds.has(id) && id !== session.id) {
                        WPNotify.memberLeft(prevMembersRef.current[id]?.name || 'Ai đó');
                    }
                }
            }

            prevMembersRef.current = currentMembers;
            setRoom(roomData);

            if (roomData.playback?.episode !== undefined) {
                setCurrentEpisode(roomData.playback.episode);
            }
            setLoading(false);

            // ── Auto Host Promotion ──
            if (roomData.members) {
                const memberList = Object.values(roomData.members);
                const currentHost = memberList.find(m => m.isHost);

                if (!currentHost && memberList.length > 0 && !promotingRef.current) {
                    const oldest = [...memberList].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];
                    if (oldest.id === session.id) {
                        promotingRef.current = true;
                        watchPartyService.promoteToHost(roomId)
                            .finally(() => { promotingRef.current = false; });
                    }
                }
            }

            // ── Fetch movie detail ONCE ──
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

            // ── Host: Global Playback Barrier ──
            if (roomData.hostId === session.id && roomData.members) {
                const bufferingMembers = Object.values(roomData.members).filter(
                    m => m.id !== session.id && m.isBuffering
                );

                if (bufferingMembers.length > 0) {
                    // Pause host video while someone buffers
                    if (videoRef.current && !videoRef.current.paused) {
                        wasPlayingBeforeBarrierRef.current = true;
                        isSyncing.current = true;
                        videoRef.current.pause();
                        setTimeout(() => { isSyncing.current = false; }, 500);
                    }
                    setWaitingFor(bufferingMembers.map(m => m.name).join(', '));
                } else {
                    // All ready — auto-resume if host was playing
                    setWaitingFor(prev => {
                        if (prev !== null && wasPlayingBeforeBarrierRef.current) {
                            wasPlayingBeforeBarrierRef.current = false;
                            if (videoRef.current && videoRef.current.paused) {
                                isSyncing.current = true;
                                videoRef.current.play().catch(() => { });
                                watchPartyService.syncPlayback(roomId, {
                                    currentTime: videoRef.current.currentTime,
                                    isPlaying: true,
                                    episode: roomRef.current?.playback?.episode ?? 0,
                                    playbackRate: videoRef.current.playbackRate,
                                });
                                watchPartyService.updateRoomStatus(roomId, 'playing');
                                setTimeout(() => { isSyncing.current = false; }, 1000);
                            }
                        }
                        return null;
                    });
                }
            }
        });

        return () => {
            unsubRoom();
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
                // Apply persisted playback rate
                const rate = roomRef.current?.playback?.playbackRate || 1;
                video.playbackRate = rate;
                setPlaybackRate(rate);

                const pb = roomRef.current?.playback;
                if (pb?.isPlaying) {
                    video.play().catch(() => { video.muted = true; setIsMuted(true); video.play().catch(() => { }); });
                }
                // Auto-resync on reconnect
                if (pb && !pb.isPlaying) {
                    const est = estimateHostTime(
                        pb.currentTime, pb.updatedAt, false, 0,
                        watchPartyService.getTrueTime
                    );
                    video.currentTime = est;
                }
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (cancelled || !data.fatal) return;
                switch (data.type) {
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        mediaRecoveryAttempts++;
                        if (mediaRecoveryAttempts <= MAX_RECOVERY) {
                            hls.recoverMediaError();
                        } else {
                            // Exhausted retries → fall through to embed if available
                            hls.destroy(); hlsRef.current = null; setHlsFailed(true);
                        }
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

    // ── Host heartbeat (drift correction fallback) ──
    useEffect(() => {
        if (!room || room.hostId !== session.id) return;
        heartbeatRef.current = setInterval(() => {
            if (!videoRef.current || isSyncing.current) return;
            watchPartyService.syncPlayback(roomId, {
                currentTime: videoRef.current.currentTime,
                isPlaying: !videoRef.current.paused,
                episode: currentEpisode,
                playbackRate: videoRef.current.playbackRate,
            });
        }, HEARTBEAT_INTERVAL_MS);
        return () => clearInterval(heartbeatRef.current);
    }, [room, currentEpisode, roomId]);

    // ── Sync viewer to host (latency-compensated) ──
    const syncToHost = useCallback((playback) => {
        const video = videoRef.current;
        if (!video || isSyncing.current || roomRef.current?.hostId === session.id) return;

        const estimated = estimateHostTime(
            playback.currentTime,
            playback.updatedAt,
            playback.isPlaying,
            0,
            watchPartyService.getTrueTime
        );

        const drift = Math.abs(video.currentTime - estimated);
        isSyncing.current = true;

        if (drift > SYNC_THRESHOLD_SECONDS) {
            video.currentTime = estimated;
        }

        // Apply playback rate from host
        const rate = playback.playbackRate || 1;
        if (video.playbackRate !== rate) {
            video.playbackRate = rate;
            setPlaybackRate(rate);
        }

        if (playback.isPlaying && video.paused) {
            video.play().catch(() => { });
            setIsPlaying(true);
        } else if (!playback.isPlaying && !video.paused) {
            video.pause();
            setIsPlaying(false);
        }

        setTimeout(() => { isSyncing.current = false; }, 1000);
    }, [session.id]);



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
        if (roomRef.current && roomRef.current.hostId !== session.id) {
            if (!roomRef.current.playback?.isPlaying) videoRef.current?.pause();
        }
    };
    const onPause = () => { if (!isSyncing.current) setIsPlaying(false); };
    const onWaiting = () => {
        setIsBuffering(true);
        watchPartyService.reportBuffering(roomId, true);
        // If HOST is buffering, broadcast pause to all viewers immediately
        if (roomRef.current?.hostId === session.id && videoRef.current && !videoRef.current.paused) {
            isSyncing.current = true;
            videoRef.current.pause();
            watchPartyService.syncPlayback(roomId, {
                currentTime: videoRef.current.currentTime,
                isPlaying: false,
                episode: roomRef.current?.playback?.episode ?? 0,
                playbackRate: videoRef.current.playbackRate,
            });
            watchPartyService.updateRoomStatus(roomId, 'paused');
            setTimeout(() => { isSyncing.current = false; }, 500);
        }
    };
    const onCanPlay = () => {
        const wasHostBuffering = isBuffering && roomRef.current?.hostId === session.id;
        setIsBuffering(false);
        watchPartyService.reportBuffering(roomId, false);
        // If HOST just finished buffering and room was playing, resume for everyone
        if (wasHostBuffering && roomRef.current?.playback?.isPlaying && videoRef.current?.paused) {
            isSyncing.current = true;
            videoRef.current.play().catch(() => { });
            watchPartyService.syncPlayback(roomId, {
                currentTime: videoRef.current.currentTime,
                isPlaying: true,
                episode: roomRef.current?.playback?.episode ?? 0,
                playbackRate: videoRef.current.playbackRate,
            });
            watchPartyService.updateRoomStatus(roomId, 'playing');
            setTimeout(() => { isSyncing.current = false; }, 1000);
        }
    };

    // ── Controls ──
    const handlePlayPause = useCallback(() => {
        const video = videoRef.current;
        if (!video || !videoReady || !isHost) return;
        isSyncing.current = true;

        if (video.paused) {
            const members = roomRef.current?.members;
            if (!allMembersReady(members)) {
                isSyncing.current = false;
                return;
            }
            video.play().catch(() => { video.muted = true; setIsMuted(true); video.play().catch(() => { }); });
            watchPartyService.syncPlayback(roomId, {
                currentTime: video.currentTime,
                isPlaying: true,
                episode: currentEpisode,
                playbackRate: video.playbackRate,
            });
            watchPartyService.updateRoomStatus(roomId, 'playing');
            WPNotify.hostPlayed(nickname || 'Host');
        } else {
            video.pause();
            watchPartyService.syncPlayback(roomId, {
                currentTime: video.currentTime,
                isPlaying: false,
                episode: currentEpisode,
                playbackRate: video.playbackRate,
            });
            watchPartyService.updateRoomStatus(roomId, 'paused');
            WPNotify.hostPaused(nickname || 'Host');
        }

        setTimeout(() => { isSyncing.current = false; }, 1000);
    }, [room, currentEpisode, roomId, videoReady, isHost, nickname]);

    const handleSeek = (e) => {
        const video = videoRef.current;
        if (!video || !isHost) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const newTime = ((e.clientX - rect.left) / rect.width) * duration;
        video.currentTime = newTime;
        // Immediate sync on seek (no throttle)
        watchPartyService.syncPlayback(roomId, {
            currentTime: newTime,
            isPlaying: !video.paused,
            episode: currentEpisode,
            playbackRate: video.playbackRate,
        });
    };

    /** Host changes playback speed — sync to all viewers immediately */
    const handleSpeedChange = useCallback((rate) => {
        if (!isHost || !videoRef.current) return;
        const video = videoRef.current;
        video.playbackRate = rate;
        setPlaybackRate(rate);
        watchPartyService.syncPlayback(roomId, {
            currentTime: video.currentTime,
            isPlaying: !video.paused,
            episode: currentEpisode,
            playbackRate: rate,
        });
    }, [isHost, currentEpisode, roomId]);

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        localStorage.setItem('smurf_volume', String(val));
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


    const handleEpisodeChange = async (epIdx) => {
        if (!isHost) return;
        setCurrentEpisode(epIdx);
        const epName = episodes[epIdx]?.name || `Tập ${epIdx + 1}`;
        await watchPartyService.syncPlayback(roomId, {
            episode: epIdx,
            currentTime: 0,
            isPlaying: false,
            playbackRate: 1,
        });
        await watchPartyService.updateRoomStatus(roomId, 'waiting');
        WPNotify.hostChangedEpisode(nickname || 'Host', epName);
        setPlaybackRate(1);
        if (videoRef.current) videoRef.current.playbackRate = 1;
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

    const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

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
                                        ⏳ Đang chờ <strong>{waitingFor}</strong> tải video...
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

                                    {/* Volume control */}
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
                                    {/* Playback speed selector */}
                                    {isHost && (
                                        <select
                                            className={styles.speedSelect}
                                            value={playbackRate}
                                            onChange={e => handleSpeedChange(parseFloat(e.target.value))}
                                            title="Tốc độ phát"
                                        >
                                            {SPEED_OPTIONS.map(r => (
                                                <option key={r} value={r}>{r === 1 ? 'x1 (Bình thường)' : `x${r}`}</option>
                                            ))}
                                        </select>
                                    )}
                                    {!isHost && playbackRate !== 1 && (
                                        <span className={styles.syncLabel}>x{playbackRate}</span>
                                    )}
                                    <button className={styles.iconBtn} onClick={handleFullscreen}><FiMaximize /></button>
                                    {document.pictureInPictureEnabled && (
                                        <button
                                            className={styles.iconBtn}
                                            onClick={async () => {
                                                const v = videoRef.current;
                                                if (!v) return;
                                                try {
                                                    if (document.pictureInPictureElement) await document.exitPictureInPicture();
                                                    else await v.requestPictureInPicture();
                                                } catch (e) { console.warn(e); }
                                            }}
                                            title="Picture-in-Picture"
                                        >
                                            <FiSquare size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Seek bar — HLS only */}
                        {hasHls && (
                            <div
                                className={`${styles.seekBar} ${!isHost ? styles.seekBarLocked : ''}`}
                                onClick={isHost ? handleSeek : undefined}
                                title={!isHost ? '🔒 Chỉ host mới có thể tua phim' : 'Kéo để tua'}
                            >
                                <div
                                    className={styles.seekProgress}
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                                {!isHost && (
                                    <div className={styles.seekLockBadge}>🔒</div>
                                )}
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
                </div>
            </main>
        </>
    );
};

export default WatchPartyRoom;
