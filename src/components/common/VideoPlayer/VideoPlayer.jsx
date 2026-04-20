import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import {
    FiPlay, FiPause, FiVolume2, FiVolumeX, FiVolume1,
    FiMaximize, FiMinimize,
    FiSkipForward, FiSkipBack,
    FiChevronUp, FiChevronDown,
    FiSquare,
} from 'react-icons/fi';
import styles from './VideoPlayer.module.css';
import { isLowPerformanceMode } from '@/utils/device';

const VideoPlayer = ({
    src,
    poster,
    onError,
    onTimeUpdate: onTimeUpdateProp,
    initialTime = 0,
    onProgress,
    tvUltraLite = false,
}) => {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const containerRef = useRef(null);
    const hideTimer = useRef(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [isPiP, setIsPiP] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [buffered, setBuffered] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);

    // Initialize HLS
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        setIsBuffering(true);
        setPlaying(false);

        const lowPerformanceMode = isLowPerformanceMode() || tvUltraLite;

        if (Hls.isSupported()) {
            const hls = new Hls(lowPerformanceMode
                ? (tvUltraLite ? {
                    maxBufferLength: 8,
                    maxMaxBufferLength: 14,
                    backBufferLength: 8,
                    capLevelToPlayerSize: true,
                    maxBufferSize: 12 * 1000 * 1000,
                } : {
                    maxBufferLength: 10,
                    maxMaxBufferLength: 20,
                    backBufferLength: 15,
                    capLevelToPlayerSize: true,
                    maxBufferSize: 20 * 1000 * 1000,
                })
                : {
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                }
            );
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (initialTime > 0) {
                    video.currentTime = initialTime;
                }
                video.play().catch(() => { });
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    if (onError) onError(data);
                }
            });

            return () => {
                hls.destroy();
                hlsRef.current = null;
            };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(() => { });
            });
        }
    }, [src]);

    // Time updates
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onTimeUpdate = () => {
            setCurTime(video.currentTime);
            if (onTimeUpdateProp) onTimeUpdateProp(video.currentTime);
            if (onProgress) onProgress({ currentTime: video.currentTime, duration: video.duration || 0 });
            if (video.buffered.length > 0) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
            }
        };
        const onDurationChange = () => setDuration(video.duration || 0);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onWaiting = () => setIsBuffering(true);
        const onCanPlay = () => setIsBuffering(false);
        const onPlaying = () => setIsBuffering(false);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('playing', onPlaying);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('playing', onPlaying);
        };
    }, [onTimeUpdateProp]);

    const shouldAutoHideControls = !tvUltraLite;

    // Auto-hide controls
    const resetHideTimer = useCallback(() => {
        if (!shouldAutoHideControls) {
            setShowControls(true);
            clearTimeout(hideTimer.current);
            return;
        }

        setShowControls(true);
        clearTimeout(hideTimer.current);
        if (playing) {
            hideTimer.current = setTimeout(() => setShowControls(false), 3000);
        }
    }, [playing, shouldAutoHideControls]);

    useEffect(() => {
        resetHideTimer();
        return () => clearTimeout(hideTimer.current);
    }, [playing, resetHideTimer]);

    // Fullscreen change listener
    useEffect(() => {
        const onFSChange = () => {
            setFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFSChange);
        return () => document.removeEventListener('fullscreenchange', onFSChange);
    }, []);

    // Picture-in-Picture event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onEnterPiP = () => setIsPiP(true);
        const onLeavePiP = () => setIsPiP(false);
        video.addEventListener('enterpictureinpicture', onEnterPiP);
        video.addEventListener('leavepictureinpicture', onLeavePiP);
        return () => {
            video.removeEventListener('enterpictureinpicture', onEnterPiP);
            video.removeEventListener('leavepictureinpicture', onLeavePiP);
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only handle if video player is in view / focused context
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'KeyF':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    seek(-10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    seek(10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    adjustVolume(0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    adjustVolume(-0.1);
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Controls
    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        v.paused ? v.play() : v.pause();
    };

    const seek = (seconds) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
    };

    const handleSeek = (e) => {
        const v = videoRef.current;
        if (!v || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        v.currentTime = pct * duration;
    };

    const handleVolume = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        setMuted(val === 0);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
        }
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        const newMuted = !muted;
        setMuted(newMuted);
        v.muted = newMuted;
    };

    const adjustVolume = (delta) => {
        const v = videoRef.current;
        if (!v) return;
        const newVol = Math.max(0, Math.min(1, v.volume + delta));
        setVolume(newVol);
        setMuted(newVol === 0);
        v.volume = newVol;
        v.muted = newVol === 0;
    };

    const toggleFullscreen = () => {
        const c = containerRef.current;
        if (!c) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            c.requestFullscreen();
        }
    };

    const pipWindowRef = useRef(null);

    const togglePiP = async () => {
        const v = videoRef.current;
        if (!v) return;

        // Exit PiP if already active
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
            return;
        }
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture().catch(() => { });
            return;
        }

        try {
            // Use documentPictureInPicture API (Chrome 116+) for custom controls
            if ('documentPictureInPicture' in window) {
                const pipWin = await window.documentPictureInPicture.requestWindow({
                    width: 480,
                    height: 300,
                });
                pipWindowRef.current = pipWin;

                // Copy stylesheets into PiP window
                [...document.styleSheets].forEach(sheet => {
                    try {
                        const styleEl = pipWin.document.createElement('style');
                        styleEl.textContent = [...sheet.cssRules].map(r => r.cssText).join('');
                        pipWin.document.head.appendChild(styleEl);
                    } catch { /* cross-origin sheets */ }
                });

                // Inject video element into PiP window
                pipWin.document.body.style.cssText = 'm:0;p:0;background:#000;overflow:hidden;display:flex;flex-direction:column;height:100%';
                const pipBody = pipWin.document.body;

                // Video
                pipBody.appendChild(v);

                // Custom controls bar
                const bar = pipWin.document.createElement('div');
                bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;display:flex;align-items:center;gap:8px;padding:8px 12px;background:linear-gradient(transparent,rgba(0,0,0,0.9));z-index:99';

                const mkBtn = (label, fn) => {
                    const b = pipWin.document.createElement('button');
                    b.textContent = label;
                    b.style.cssText = 'background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:16px;cursor:pointer;flex-shrink:0';
                    b.onclick = fn;
                    return b;
                };

                const playBtn = mkBtn(v.paused ? '▶' : '⏸', () => {
                    v.paused ? v.play() : v.pause();
                    playBtn.textContent = v.paused ? '▶' : '⏸';
                });
                v.addEventListener('play', () => { playBtn.textContent = '⏸'; });
                v.addEventListener('pause', () => { playBtn.textContent = '▶'; });

                // Seek buttons
                const seekBack = mkBtn('⏪', () => {
                    v.currentTime = Math.max(0, v.currentTime - 10);
                });
                seekBack.title = 'Lùi 10 giây';

                const seekFwd = mkBtn('⏩', () => {
                    v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
                });
                seekFwd.title = 'Tiến 10 giây';

                const volDown = mkBtn('🔉', () => {
                    v.volume = Math.max(0, v.volume - 0.1);
                    setVolume(parseFloat(v.volume.toFixed(2)));
                    volPct.textContent = Math.round(v.volume * 100) + '%';
                });
                const volUp = mkBtn('🔊', () => {
                    v.volume = Math.min(1, v.volume + 0.1);
                    setVolume(parseFloat(v.volume.toFixed(2)));
                    volPct.textContent = Math.round(v.volume * 100) + '%';
                });
                const muteBtn = mkBtn(v.muted ? '🔇' : '🔈', () => {
                    v.muted = !v.muted;
                    muteBtn.textContent = v.muted ? '🔇' : '🔈';
                    setMuted(v.muted);
                });

                // Volume percentage display
                const volPct = pipWin.document.createElement('span');
                volPct.textContent = Math.round(v.volume * 100) + '%';
                volPct.style.cssText = 'color:rgba(255,255,255,0.75);font-size:11px;min-width:28px;text-align:center;flex-shrink:0';
                v.addEventListener('volumechange', () => {
                    volPct.textContent = v.muted ? '🔇' : Math.round(v.volume * 100) + '%';
                });

                // Time display
                const timeEl = pipWin.document.createElement('span');
                timeEl.style.cssText = 'color:rgba(255,255,255,0.8);font-size:12px;margin-left:auto;font-variant-numeric:tabular-nums';
                const fmtT = s => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; };
                v.addEventListener('timeupdate', () => {
                    timeEl.textContent = `${fmtT(v.currentTime)} / ${fmtT(v.duration)}`;
                });

                bar.append(seekBack, playBtn, seekFwd, volDown, muteBtn, volUp, volPct, timeEl);
                pipBody.appendChild(bar);

                // Restore video to player container when PiP closes
                pipWin.addEventListener('pagehide', () => {
                    containerRef.current?.appendChild(v);
                    setIsPiP(false);
                    pipWindowRef.current = null;
                });
                setIsPiP(true);
            } else if (document.pictureInPictureEnabled) {
                // Fallback: standard PiP (no custom controls)
                await v.requestPictureInPicture();
            }
        } catch (e) {
            console.warn('PiP error:', e);
        }
    };

    const formatTime = (secs) => {
        if (!secs || isNaN(secs)) return '00:00';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const progressPct = duration ? (currentTime / duration) * 100 : 0;
    const bufferedPct = duration ? (buffered / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            className={`${styles.playerContainer} ${fullscreen ? styles.fullscreen : ''}`}
            onMouseMove={shouldAutoHideControls ? resetHideTimer : undefined}
            onMouseLeave={shouldAutoHideControls ? () => playing && setShowControls(false) : undefined}
            onClick={(e) => {
                if (e.target === videoRef.current || e.target.classList.contains(styles.videoOverlay)) {
                    togglePlay();
                }
            }}
        >
            <video
                ref={videoRef}
                className={styles.video}
                poster={poster}
                playsInline
            />

            {/* Buffering loading overlay */}
            {isBuffering && (
                <div className={styles.bufferingOverlay}>
                    <div className={styles.bufferingSpinner}>
                        <div className={styles.spinnerRing}></div>
                    </div>
                </div>
            )}

            {/* Center play icon on pause */}
            {!playing && !isBuffering && (
                <div className={styles.centerPlay} onClick={togglePlay}>
                    <FiPlay size={48} />
                </div>
            )}

            {/* Keyboard hints */}
            {!tvUltraLite && (
                <div className={styles.keyHints}>
                    <span>Space: Dừng/Phát</span>
                    <span>F: Toàn màn hình</span>
                    <span>← →: ±10s</span>
                    <span>↑ ↓: Âm lượng</span>
                </div>
            )}

            {/* Controls overlay */}
            <div className={`${styles.controls} ${showControls ? styles.controlsVisible : ''}`}>
                {/* Progress bar */}
                <div className={styles.progressBar} onClick={handleSeek}>
                    <div className={styles.progressBuffered} style={{ width: `${bufferedPct}%` }} />
                    <div className={styles.progressPlayed} style={{ width: `${progressPct}%` }}>
                        <div className={styles.progressThumb} />
                    </div>
                </div>

                <div className={styles.controlsRow}>
                    {/* Left controls */}
                    <div className={styles.controlsLeft}>
                        <button className={styles.controlBtn} onClick={togglePlay} title="Space">
                            {playing ? <FiPause size={20} /> : <FiPlay size={20} />}
                        </button>

                        <button className={styles.controlBtn} onClick={() => seek(-10)} title="← Lùi 10s">
                            <FiSkipBack size={18} />
                            <span className={styles.seekLabel}>10</span>
                        </button>

                        <button className={styles.controlBtn} onClick={() => seek(10)} title="→ Tiến 10s">
                            <FiSkipForward size={18} />
                            <span className={styles.seekLabel}>10</span>
                        </button>

                        <div className={styles.volumeControl}>
                            <button className={styles.controlBtn} onClick={toggleMute} title="Tắt/Bật tiếng">
                                {muted || volume === 0 ? <FiVolumeX size={18} /> : volume < 0.5 ? <FiVolume1 size={18} /> : <FiVolume2 size={18} />}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={muted ? 0 : volume}
                                onChange={handleVolume}
                                className={styles.volumeSlider}
                            />
                            <button className={styles.controlBtn} onClick={() => adjustVolume(-0.1)} title="Giảm âm lượng (↓)">
                                <FiChevronDown size={18} />
                            </button>
                            <button className={styles.controlBtn} onClick={() => adjustVolume(0.1)} title="Tăng âm lượng (↑)">
                                <FiChevronUp size={18} />
                            </button>
                        </div>

                        <span className={styles.timeDisplay}>
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* Right controls */}
                    <div className={styles.controlsRight}>
                        {!tvUltraLite && document.pictureInPictureEnabled && (
                            <button
                                className={`${styles.controlBtn} ${isPiP ? styles.pipActive : ''}`}
                                onClick={togglePiP}
                                title="Picture-in-Picture"
                            >
                                <FiSquare size={16} />
                            </button>
                        )}
                        <button className={styles.controlBtn} onClick={toggleFullscreen} title="F: Toàn màn hình">
                            {fullscreen ? <FiMinimize size={18} /> : <FiMaximize size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
