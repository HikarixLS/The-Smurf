import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Button from '@/components/common/Button/Button';
import Loader from '@/components/common/Loader/Loader';
import { movieService } from '@/services/api/movieService';
import styles from './Watch.module.css';

const Watch = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEpisode, setCurrentEpisode] = useState(0);

  useEffect(() => {
    fetchMovieDetail();
  }, [slug]);

  const fetchMovieDetail = async () => {
    setLoading(true);

    try {
      const response = await movieService.getMovieDetail(slug);
      if (response && response.data && response.data.item) {
        setMovie(response.data.item);
      }
    } catch (err) {
      console.error('Error fetching movie:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.watch}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader />
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className={styles.watch}>
        <div className={styles.container}>
          <h1 style={{ color: 'white' }}>Không tìm thấy phim</h1>
          <Button onClick={() => navigate('/')}>Về trang chủ</Button>
        </div>
      </div>
    );
  }

  const episodes = movie.episodes && movie.episodes.length > 0
    ? movie.episodes[0].server_data || []
    : [];

  const currentVideo = episodes[currentEpisode];

  return (
    <div className={styles.watch}>
      <div className={styles.container}>
        <div className={styles.actions}>
          <Button
            onClick={() => navigate(`/movie/${slug}`)}
            icon={<FiArrowLeft />}
            variant="secondary"
          >
            Quay lại
          </Button>
        </div>

        <div className={styles.playerWrapper}>
          {currentVideo && currentVideo.link_embed ? (
            <iframe
              src={currentVideo.link_embed}
              className={styles.player}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : currentVideo && currentVideo.link_m3u8 ? (
            <video
              src={currentVideo.link_m3u8}
              className={styles.player}
              controls
              autoPlay
            />
          ) : (
            <div className={styles.noVideo}>
              Không có nguồn phim khả dụng
            </div>
          )}
        </div>

        <div className={styles.info}>
          <h1 className={styles.title}>{movie.name}</h1>
          <div className={styles.meta}>
            <span>{movie.year}</span>
            <span>{movie.quality}</span>
            <span>{movie.lang}</span>
            {currentVideo && <span>Tập {currentVideo.name}</span>}
          </div>

          {episodes.length > 1 && (
            <div className={styles.episodeSelector}>
              <h2 className={styles.sectionTitle}>Chọn tập</h2>
              <div className={styles.episodes}>
                {episodes.map((ep, index) => (
                  <button
                    key={index}
                    className={`${styles.episodeBtn} ${index === currentEpisode ? styles.active : ''}`}
                    onClick={() => setCurrentEpisode(index)}
                  >
                    {ep.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Watch;
