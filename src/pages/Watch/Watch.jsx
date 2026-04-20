import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiMonitor, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import VideoPlayer from '@/components/common/VideoPlayer/VideoPlayer';
import MovieRow from '@/components/home/MovieRow/MovieRow';
import Loader from '@/components/common/Loader/Loader';
import { movieService } from '@/services/api/movieService';
import { useAuth } from '@/services/firebase/AuthContext';
import { addToHistory, saveWatchProgress, getWatchProgress } from '@/services/firebase/watchlistService';
import { getImageUrl, getWebpImageUrl, handleOptimizedImageError, PLACEHOLDER_IMG } from '@/utils/helpers';
import styles from './Watch.module.css';

const Watch = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEpisode, setCurrentEpisode] = useState(() => {
    const ep = parseInt(searchParams.get('ep') || '0', 10);
    return isNaN(ep) ? 0 : ep;
  });
  const [currentServer, setCurrentServer] = useState(0);
  const [relatedMovies, setRelatedMovies] = useState([]);
  const [showEpisodes, setShowEpisodes] = useState(true);
  const [savedProgress, setSavedProgress] = useState(null); // tiến trình đọc từ Firebase
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [resumeTime, setResumeTime] = useState(0); // thời gian seek khi tiếp tục

  // Refs để throttle lưu tiến trình (5 giây/lần)
  const lastSaveRef = useRef(0);
  const latestProgressRef = useRef(null); // lưu progress mới nhất để dùng khi unmount


  useEffect(() => {
    fetchMovieDetail();
  }, [slug]);

  // Đọc tiến trình đã lưu khi load phim — hiển thị dialog nếu có
  useEffect(() => {
    if (!user || !slug) return;
    setSavedProgress(null);
    setShowResumeDialog(false);
    setResumeTime(0);
    getWatchProgress(user.uid, slug).then(progress => {
      if (progress) {
        setSavedProgress(progress);
        // Chỉ hỏi nếu đúng tập đang xem
        if (progress.episodeIndex === currentEpisode && progress.serverIndex === currentServer) {
          setShowResumeDialog(true);
        }
      }
    }).catch(() => { });
  }, [user, slug]);

  // Track watch history
  useEffect(() => {
    if (user && movie) {
      // Explicitly pass slug from URL params to guarantee Firebase key
      addToHistory(user.uid, { ...movie, slug }).catch(() => { });
    }
  }, [user, movie]);

  // Lưu tiến trình khi unmount (rời trang)
  useEffect(() => {
    return () => {
      if (user && slug && latestProgressRef.current) {
        const { currentTime, duration } = latestProgressRef.current;
        saveWatchProgress(user.uid, slug, {
          currentTime, duration,
          episodeIndex: currentEpisode,
          serverIndex: currentServer,
        }).catch(() => { });
      }
    };
  }, [user, slug, currentEpisode, currentServer]);

  // Callback nhận progress từ VideoPlayer - throttle 5 giây
  const handleProgress = useCallback(({ currentTime, duration }) => {
    latestProgressRef.current = { currentTime, duration };
    const now = Date.now();
    if (now - lastSaveRef.current < 5000) return;
    lastSaveRef.current = now;
    if (user && slug) {
      saveWatchProgress(user.uid, slug, {
        currentTime, duration,
        episodeIndex: currentEpisode,
        serverIndex: currentServer,
      }).catch(() => { });
    }
  }, [user, slug, currentEpisode, currentServer]);


  const fetchMovieDetail = async () => {
    setLoading(true);
    try {
      const response = await movieService.getMovieDetail(slug);
      if (response?.data?.item) {
        setMovie(response.data.item);
        // Fetch related
        if (response.data.item.category?.length > 0) {
          try {
            const catRes = await movieService.getMoviesByCategory(
              response.data.item.category[0].slug, 1
            );
            if (catRes?.data?.items) {
              setRelatedMovies(catRes.data.items.filter(m => m.slug !== slug).slice(0, 12));
            }
          } catch (e) { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className={styles.loadingPage}>
      <Loader />
    </div>
  );

  if (!movie) return (
    <>
      <Header />
      <div className={styles.errorPage}>
        <h1>Không tìm thấy phim</h1>
        <button onClick={() => navigate('/')}>Về trang chủ</button>
      </div>
    </>
  );

  const servers = movie.episodes || [];
  const currentServerData = servers[currentServer]?.server_data || [];
  const currentVideo = currentServerData[currentEpisode];
  const originalPosterUrl = getImageUrl(movie.poster_url || movie.thumb_url);
  const posterUrl = getWebpImageUrl(movie.poster_url || movie.thumb_url);

  return (
    <>
      <Header />
      <main className={styles.watch}>
        <div className={styles.container}>
          {/* Back button */}
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => navigate(`/movie/${slug}`)}>
              <FiArrowLeft /> Quay lại
            </button>
            <div className={styles.nowPlaying}>
              <span className={styles.movieName}>{movie.origin_name || movie.name}</span>
              {currentVideo && (
                <span className={styles.episodeName}>- Tập {currentVideo.name}</span>
              )}
            </div>
          </div>

          {/* Video Player */}
          <div className={styles.playerSection}>
            <div className={styles.playerWrapper}>
              {/* Resume dialog */}
              {showResumeDialog && savedProgress && (
                <div className={styles.resumeDialog}>
                  <div className={styles.resumeDialogBox}>
                    <p className={styles.resumeTitle}>Bạn đã xem đến</p>
                    <p className={styles.resumeTime}>
                      {Math.floor(savedProgress.currentTime / 60)}:{String(Math.floor(savedProgress.currentTime % 60)).padStart(2, '0')}
                      {savedProgress.duration > 0 && (
                        <span className={styles.resumePct}> &bull; {Math.round(savedProgress.percent * 100)}%</span>
                      )}
                    </p>
                    <div className={styles.resumeActions}>
                      <button
                        className={styles.resumeContinueBtn}
                        onClick={() => {
                          setResumeTime(savedProgress.currentTime);
                          setShowResumeDialog(false);
                        }}
                      >
                        ▶ Xem tiếp
                      </button>
                      <button
                        className={styles.resumeRestartBtn}
                        onClick={() => {
                          setResumeTime(0);
                          setShowResumeDialog(false);
                        }}
                      >
                        ↺ Xem lại từ đầu
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentVideo?.link_m3u8 && !showResumeDialog ? (
                <VideoPlayer
                  src={currentVideo.link_m3u8}
                  poster={posterUrl}
                  initialTime={resumeTime}
                  onProgress={handleProgress}
                />
              ) : currentVideo?.link_m3u8 ? (
                // Dialog đang hiển thị — hiển poster chờ
                <img
                  src={posterUrl}
                  data-original-src={originalPosterUrl}
                  alt={movie.name}
                  className={styles.posterPlaceholder}
                  onError={(e) => handleOptimizedImageError(e, { fallbackSrc: PLACEHOLDER_IMG })}
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
                  <FiMonitor size={48} />
                  <p>Không có nguồn phim khả dụng</p>
                </div>
              )}
            </div>
          </div>


          {/* Server selector */}
          {servers.length > 1 && (
            <div className={styles.serverSection}>
              <h3 className={styles.sectionTitle}>Chọn server</h3>
              <div className={styles.serverList}>
                {servers.map((server, i) => (
                  <button
                    key={i}
                    className={`${styles.serverBtn} ${i === currentServer ? styles.serverActive : ''}`}
                    onClick={() => { setCurrentServer(i); setCurrentEpisode(0); }}
                  >
                    {server.server_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Episode selector */}
          {currentServerData.length > 1 && (
            <div className={styles.episodeSection}>
              <button
                className={styles.episodeToggle}
                onClick={() => setShowEpisodes(!showEpisodes)}
              >
                <h3 className={styles.sectionTitle}>
                  Danh sách tập ({currentServerData.length} tập)
                </h3>
                {showEpisodes ? <FiChevronUp /> : <FiChevronDown />}
              </button>

              {showEpisodes && (
                <div className={styles.episodeGrid}>
                  {currentServerData.map((ep, index) => (
                    <button
                      key={index}
                      className={`${styles.episodeBtn} ${index === currentEpisode ? styles.episodeActive : ''}`}
                      onClick={() => setCurrentEpisode(index)}
                    >
                      {ep.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Movie info */}
          <div className={styles.movieInfo}>
            <h2 className={styles.movieTitle}>{movie.origin_name || movie.name}</h2>
            <div className={styles.meta}>
              {movie.year && <span>{movie.year}</span>}
              {movie.quality && <span className={styles.qualityTag}>{movie.quality}</span>}
              {movie.lang && <span className={styles.langTag}>{movie.lang}</span>}
              {movie.episode_current && <span>{movie.episode_current}</span>}
            </div>
          </div>
        </div>

        {/* Related movies */}
        {relatedMovies.length > 0 && (
          <div className={styles.relatedSection}>
            <MovieRow title="Phim đề xuất" movies={relatedMovies} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
};

export default Watch;
