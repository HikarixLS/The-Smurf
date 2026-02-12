import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiStar, FiClock, FiCalendar, FiPlay } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import Loader from '@/components/common/Loader/Loader';
import Button from '@/components/common/Button/Button';
import { movieService } from '@/services/api/movieService';
import { getImageUrl, stripHtml } from '@/utils/helpers';
import styles from './MovieDetail.module.css';

const MovieDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMovieDetail();
  }, [slug]);

  const fetchMovieDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await movieService.getMovieDetail(slug);
      if (response && response.data && response.data.item) {
        setMovie(response.data.item);
      } else {
        setError('Không tìm thấy phim');
      }
    } catch (err) {
      setError('Lỗi tải thông tin phim');
      console.error('Error fetching movie detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWatch = () => {
    navigate(`/watch/${slug}`);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader />
        </div>
        <Footer />
      </>
    );
  }

  if (error || !movie) {
    return (
      <>
        <Header />
        <div className="container" style={{ minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
          <h1>{error || 'Không tìm thấy phim'}</h1>
          <Button onClick={() => navigate('/')}>Về trang chủ</Button>
        </div>
        <Footer />
      </>
    );
  }

  const posterUrl = getImageUrl(movie.poster_url || movie.thumb_url);
  const rating = movie.tmdb?.vote_average || movie.imdb?.rating || 0;

  return (
    <>
      <Header />
      <main className={styles.movieDetail}>
        <div className={styles.hero}>
          <img
            src={posterUrl}
            alt={movie.name}
            className={styles.backdrop}
          />
          <div className={styles.heroOverlay}>
            <h1 className={styles.title}>{movie.name}</h1>
            <div className={styles.meta}>
              {movie.year && (
                <span className={styles.metaItem}>
                  <FiCalendar /> {movie.year}
                </span>
              )}
              {rating > 0 && (
                <span className={styles.metaItem}>
                  <FiStar /> {rating.toFixed(1)}
                </span>
              )}
              {movie.time && (
                <span className={styles.metaItem}>
                  <FiClock /> {movie.time}
                </span>
              )}
              {movie.quality && <span>{movie.quality}</span>}
              {movie.lang && <span>{movie.lang}</span>}
            </div>
          </div>
        </div>

        <div className="container">
          <div className={styles.content}>
            <div className={styles.poster}>
              <img src={posterUrl} alt={movie.name} className={styles.posterImg} />
            </div>

            <div className={styles.info}>
              <div className={styles.actions}>
                <Button
                  onClick={handleWatch}
                  icon={<FiPlay />}
                  size="large"
                >
                  Xem phim
                </Button>
                <Button variant="secondary" size="large">
                  Watchlist
                </Button>
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Nội dung</h2>
                <p className={styles.description}>
                  {movie.content ? stripHtml(movie.content) : 'Đang cập nhật...'}
                </p>
              </div>

              {movie.category && movie.category.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Thể loại</h2>
                  <div className={styles.tags}>
                    {movie.category.map((cat, index) => (
                      <span key={index} className={styles.tag}>
                        {cat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {movie.country && movie.country.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Quốc gia</h2>
                  <div className={styles.tags}>
                    {movie.country.map((c, index) => (
                      <span key={index} className={styles.tag}>
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {movie.actor && movie.actor.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Diễn viên</h2>
                  <p className={styles.description}>{movie.actor.join(', ')}</p>
                </div>
              )}

              {movie.director && movie.director.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Đạo diễn</h2>
                  <p className={styles.description}>{movie.director.join(', ')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default MovieDetail;
