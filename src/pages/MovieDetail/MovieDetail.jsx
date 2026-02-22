import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPlay, FiHeart, FiBookmark, FiShare2, FiStar, FiClock, FiCalendar } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieRow from '@/components/home/MovieRow/MovieRow';
import Loader from '@/components/common/Loader/Loader';
import { movieService } from '@/services/api/movieService';
import { getImageUrl, stripHtml } from '@/utils/helpers';
import styles from './MovieDetail.module.css';

const MovieDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [relatedMovies, setRelatedMovies] = useState([]);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    fetchMovieDetail();
  }, [slug]);

  const fetchMovieDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await movieService.getMovieDetail(slug);
      if (response?.data?.item) {
        setMovie(response.data.item);
        // Fetch related movies by first category
        if (response.data.item.category?.length > 0) {
          try {
            const catRes = await movieService.getMoviesByCategory(
              response.data.item.category[0].slug, 1
            );
            if (catRes?.data?.items) {
              setRelatedMovies(catRes.data.items.filter(m => m.slug !== slug));
            }
          } catch (e) { /* ignore */ }
        }
      } else {
        setError('Không tìm thấy phim');
      }
    } catch (err) {
      setError('Lỗi tải thông tin phim');
    } finally {
      setLoading(false);
    }
  };

  const handleWatch = () => navigate(`/watch/${slug}`);
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: movie.name, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (loading) return (
    <>
      <Header />
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader />
      </div>
    </>
  );

  if (error || !movie) return (
    <>
      <Header />
      <div className={styles.errorPage}>
        <h1>{error || 'Không tìm thấy phim'}</h1>
        <button className={styles.homeBtn} onClick={() => navigate('/')}>Về trang chủ</button>
      </div>
      <Footer />
    </>
  );

  const posterUrl = getImageUrl(movie.poster_url || movie.thumb_url);
  const thumbUrl = getImageUrl(movie.thumb_url || movie.poster_url);
  const rating = movie.tmdb?.vote_average || 0;
  const episodes = movie.episodes?.[0]?.server_data || [];

  return (
    <>
      <Header />
      <main className={styles.movieDetail}>
        {/* Hero backdrop */}
        <div className={styles.hero}>
          <img src={posterUrl} alt="" className={styles.heroImage} />
          <div className={styles.heroOverlay} />

          <div className={styles.heroContent}>
            <div className={styles.posterWrapper}>
              <img src={thumbUrl} alt={movie.name} className={styles.poster} />
            </div>

            <div className={styles.heroInfo}>
              <h1 className={styles.title}>{movie.name}</h1>
              {movie.origin_name && (
                <p className={styles.originName}>{movie.origin_name}</p>
              )}

              <div className={styles.metaRow}>
                {rating > 0 && (
                  <span className={styles.ratingBadge}>
                    <FiStar /> {rating.toFixed(1)}
                  </span>
                )}
                {movie.year && (
                  <span className={styles.metaBadge}><FiCalendar /> {movie.year}</span>
                )}
                {movie.time && (
                  <span className={styles.metaBadge}><FiClock /> {movie.time}</span>
                )}
                {movie.quality && <span className={styles.qualityBadge}>{movie.quality}</span>}
                {movie.lang && <span className={styles.langBadge}>{movie.lang}</span>}
                {movie.episode_current && (
                  <span className={styles.metaBadge}>{movie.episode_current}</span>
                )}
              </div>

              {movie.category?.length > 0 && (
                <div className={styles.genres}>
                  {movie.category.map((cat, i) => (
                    <span key={i} className={styles.genreTag}>{cat.name}</span>
                  ))}
                </div>
              )}

              <div className={styles.actions}>
                <button className={styles.watchBtn} onClick={handleWatch}>
                  <FiPlay /> Xem Ngay
                </button>
                <button
                  className={`${styles.actionBtn} ${liked ? styles.active : ''}`}
                  onClick={() => setLiked(!liked)}
                >
                  <FiHeart />
                  <span>Yêu thích</span>
                </button>
                <button
                  className={`${styles.actionBtn} ${bookmarked ? styles.active : ''}`}
                  onClick={() => setBookmarked(!bookmarked)}
                >
                  <FiBookmark />
                  <span>Lưu lại</span>
                </button>
                <button className={styles.actionBtn} onClick={handleShare}>
                  <FiShare2 />
                  <span>Chia sẻ</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabSection}>
          <div className={styles.tabs}>
            {['overview', 'episodes', 'cast', 'related'].map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {{ overview: 'Tổng quan', episodes: 'Tập phim', cast: 'Diễn viên', related: 'Đề xuất' }[tab]}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'overview' && (
              <div className={styles.overview}>
                <h3>Nội dung</h3>
                <p className={styles.description}>
                  {movie.content ? stripHtml(movie.content) : 'Đang cập nhật...'}
                </p>

                <div className={styles.detailGrid}>
                  {movie.country?.length > 0 && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Quốc gia</span>
                      <span>{movie.country.map(c => c.name).join(', ')}</span>
                    </div>
                  )}
                  {movie.director?.length > 0 && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Đạo diễn</span>
                      <span>{movie.director.join(', ')}</span>
                    </div>
                  )}
                  {movie.status && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Trạng thái</span>
                      <span>{movie.status === 'completed' ? 'Hoàn thành' : 'Đang cập nhật'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'episodes' && (
              <div className={styles.episodesList}>
                {episodes.length > 0 ? (
                  <div className={styles.episodeGrid}>
                    {episodes.map((ep, i) => (
                      <button
                        key={i}
                        className={styles.episodeBtn}
                        onClick={() => navigate(`/watch/${slug}`)}
                      >
                        <FiPlay size={14} />
                        <span>{ep.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.empty}>Chưa có tập phim</p>
                )}
              </div>
            )}

            {activeTab === 'cast' && (
              <div className={styles.castList}>
                {movie.actor?.length > 0 ? (
                  <div className={styles.castGrid}>
                    {movie.actor.map((actor, i) => (
                      <div key={i} className={styles.castItem}>
                        <div className={styles.castAvatar}>
                          {actor.charAt(0)}
                        </div>
                        <span className={styles.castName}>{actor}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.empty}>Đang cập nhật...</p>
                )}
              </div>
            )}

            {activeTab === 'related' && (
              <div className={styles.relatedSection}>
                {relatedMovies.length > 0 ? (
                  <MovieRow title="Phim tương tự" movies={relatedMovies} />
                ) : (
                  <p className={styles.empty}>Không có phim liên quan</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default MovieDetail;
