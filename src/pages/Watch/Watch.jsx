import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMonitor, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import VideoPlayer from '@/components/common/VideoPlayer/VideoPlayer';
import MovieRow from '@/components/home/MovieRow/MovieRow';
import Loader from '@/components/common/Loader/Loader';
import { movieService } from '@/services/api/movieService';
import styles from './Watch.module.css';

const Watch = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [currentServer, setCurrentServer] = useState(0);
  const [relatedMovies, setRelatedMovies] = useState([]);
  const [showEpisodes, setShowEpisodes] = useState(true);

  useEffect(() => {
    fetchMovieDetail();
  }, [slug]);

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
              {currentVideo?.link_m3u8 ? (
                <VideoPlayer
                  src={currentVideo.link_m3u8}
                  poster={movie.poster_url || movie.thumb_url}
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
