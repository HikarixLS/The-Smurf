import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import {
    FiPlay, FiPause, FiVolume2, FiVolumeX,
    FiMaximize, FiMinimize, FiSettings,
    FiSkipForward, FiSkipBack, FiChevronsRight
} from 'react-icons/fi';
import styles from './VideoPlayer.module.css';

const VideoPlayer = ({ src, poster, onError }) => {
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
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [qualities, setQualities] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
    const [buffered, setBuffered] = useState(0);
    const [showSkipIntro, setShowSkipIntro] = useState(false);

    // Initialize HLS
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
            });
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                const levels = data.levels.map((level, i) => ({
                    index: i,
                    height: level.height,
                    width: level.width,
                    bitrate: level.bitrate,
                    label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`,
                }));
                setQualities(levels);
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
            // Show skip intro in first 2 min
            setShowSkipIntro(video.currentTime < 120 && video.currentTime > 5);
            // Buffer
            if (video.buffered.length > 0) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
            }
        };
        const onDurationChange = () => setDuration(video.duration || 0);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
        };
    }, []);

    // Auto-hide controls
    const resetHideTimer = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        if (playing) {
            hideTimer.current = setTimeout(() => setShowControls(false), 3000);
        }
    }, [playing]);

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

    const skipIntro = () => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.min(v.duration, v.currentTime + 90);
        setShowSkipIntro(false);
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

    const toggleFullscreen = () => {
        const c = containerRef.current;
        if (!c) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            c.requestFullscreen();
        }
    };

    const changeQuality = (levelIndex) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex;
            setCurrentQuality(levelIndex);
        }
        setShowSettings(false);
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
            onMouseMove={resetHideTimer}
            onMouseLeave={() => playing && setShowControls(false)}
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

            {/* Center play icon on pause */}
            {!playing && (
                <div className={styles.centerPlay} onClick={togglePlay}>
                    <FiPlay size={48} />
                </div>
            )}

            {/* Skip intro button */}
            {showSkipIntro && showControls && (
                <button className={styles.skipIntro} onClick={skipIntro}>
                    <FiChevronsRight /> Skip Intro
                </button>
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
                        <button className={styles.controlBtn} onClick={togglePlay}>
                            {playing ? <FiPause size={20} /> : <FiPlay size={20} />}
                        </button>

                        <button className={styles.controlBtn} onClick={() => seek(-10)} title="Rewind 10s">
                            <FiSkipBack size={18} />
                            <span className={styles.seekLabel}>10</span>
                        </button>

                        <button className={styles.controlBtn} onClick={() => seek(10)} title="Forward 10s">
                            <FiSkipForward size={18} />
                            <span className={styles.seekLabel}>10</span>
                        </button>

                        <div className={styles.volumeControl}>
                            <button className={styles.controlBtn} onClick={toggleMute}>
                                {muted || volume === 0 ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
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
                        </div>

                        <span className={styles.timeDisplay}>
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* Right controls */}
                    <div className={styles.controlsRight}>
                        {/* Settings / Quality */}
                        <div className={styles.settingsWrapper}>
                            <button
                                className={styles.controlBtn}
                                onClick={() => setShowSettings(!showSettings)}
                            >
                                <FiSettings size={18} />
                            </button>

                            {showSettings && (
                                <div className={styles.settingsMenu}>
                                    <div className={styles.settingsTitle}>Chất lượng</div>
                                    <button
                                        className={`${styles.qualityOption} ${currentQuality === -1 ? styles.qualityActive : ''}`}
                                        onClick={() => changeQuality(-1)}
                                    >
                                        Auto
                                    </button>
                                    {qualities.map(q => (
                                        <button
                                            key={q.index}
                                            className={`${styles.qualityOption} ${currentQuality === q.index ? styles.qualityActive : ''}`}
                                            onClick={() => changeQuality(q.index)}
                                        >
                                            {q.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className={styles.controlBtn} onClick={toggleFullscreen}>
                            {fullscreen ? <FiMinimize size={18} /> : <FiMaximize size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
