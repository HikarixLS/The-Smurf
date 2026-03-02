import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPlay, FiHeart, FiBookmark, FiShare2, FiStar, FiClock, FiCalendar } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieRow from '@/components/home/MovieRow/MovieRow';
import Loader from '@/components/common/Loader/Loader';
import { movieService } from '@/services/api/movieService';
import { getImageUrl, stripHtml } from '@/utils/helpers';
import { useAuth } from '@/services/firebase/AuthContext';
import {
  addToFavorites, removeFromFavorites, isInFavorites,
  addToWatchlist, removeFromWatchlist, isInWatchlist,
} from '@/services/firebase/watchlistService';
import styles from './MovieDetail.module.css';

const MovieDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [relatedMovies, setRelatedMovies] = useState([]);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [peoples, setPeoples] = useState([]);

  useEffect(() => {
    fetchMovieDetail();
  }, [slug]);

  // Check saved favorites/watchlist status
  useEffect(() => {
    if (!user || !slug) return;
    const checkSaved = async () => {
      const [fav, wl] = await Promise.all([
        isInFavorites(user.uid, slug),
        isInWatchlist(user.uid, slug),
      ]);
      setLiked(fav);
      setBookmarked(wl);
    };
    checkSaved();
  }, [user, slug]);

  const handleToggleLike = async () => {
    if (!user || !movie) return;
    if (liked) {
      await removeFromFavorites(user.uid, slug);
    } else {
      // Explicitly pass slug from URL params to guarantee Firebase key
      await addToFavorites(user.uid, { ...movie, slug });
    }
    setLiked(!liked);
  };

  const handleToggleBookmark = async () => {
    if (!user || !movie) return;
    if (bookmarked) {
      await removeFromWatchlist(user.uid, slug);
    } else {
      // Explicitly pass slug from URL params to guarantee Firebase key
      await addToWatchlist(user.uid, { ...movie, slug });
    }
    setBookmarked(!bookmarked);
  };

  const fetchMovieDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await movieService.getMovieDetail(slug);
      if (response?.data?.item) {
        const item = response.data.item;
        setMovie(item);

        // Fetch related movies and peoples photos in parallel
        const sideEffects = [];

        if (item.category?.length > 0) {
          sideEffects.push(
            movieService.getMoviesByCategory(item.category[0].slug, 1)
              .then(catRes => {
                if (catRes?.data?.items) {
                  setRelatedMovies(catRes.data.items.filter(m => m.slug !== slug));
                }
              }).catch(() => { })
          );
        }

        // Fetch peoples (actor photos)
        sideEffects.push(
          movieService.getMoviePeoples(slug)
            .then(res => {
              const items = res?.data?.casts || res?.data?.items || res?.casts || [];
              if (Array.isArray(items) && items.length > 0) setPeoples(items);
            }).catch(() => { })
        );

        await Promise.allSettled(sideEffects);
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
  const heroImage = posterUrl;
  const rating = movie.imdb?.rating || movie.tmdb?.vote_average || 0;
  const voteCount = movie.tmdb?.vote_count || 0;
  const episodes = movie.episodes?.[0]?.server_data || [];

  const description = movie.content
    ? stripHtml(movie.content)
    : 'Đang cập nhật...';

  const tabs = ['overview', 'episodes', 'cast', 'related'];

  const tabLabels = {
    overview: 'Tổng quan',
    episodes: 'Tập phim',
    cast: 'Diễn viên',
    related: 'Đề xuất',
  };

  // Helper: generate a unique color per actor name
  const nameToColor = (name) => {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#a18cd1', '#ffecd2'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
  };

  // Build cast list from movie.actor, enriched with peoples photos if available
  const castList = (movie.actor || []).map(name => {
    const found = peoples.find(p => p.name === name || (p.character && p.character === name));
    return { name, photo: found?.profile_path || found?.image || null };
  });

  const directorList = movie.director || [];

  return (
    <>
      <Header />
      <main className={styles.movieDetail}>
        {/* Hero backdrop */}
        <div className={styles.hero}>
          <img src={heroImage} alt="" className={styles.heroImage} />
          <div className={styles.heroOverlay} />

          <div className={styles.heroContent}>
            <div className={styles.posterWrapper}>
              <img src={thumbUrl} alt={movie.name} className={styles.poster} />
            </div>

            <div className={styles.heroInfo}>
              <h1 className={styles.title}>{movie.origin_name || movie.name}</h1>
              {movie.origin_name && movie.name !== movie.origin_name && (
                <p className={styles.originName}>{movie.name}</p>
              )}

              <div className={styles.metaRow}>
                {rating > 0 && (
                  <span className={styles.ratingBadge}>
                    <FiStar /> {rating.toFixed(1)}{voteCount > 0 ? ` (${voteCount})` : ''}
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

              {/* Keywords from API */}
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
                  onClick={handleToggleLike}
                >
                  <FiHeart />
                  <span>Yêu thích</span>
                </button>
                <button
                  className={`${styles.actionBtn} ${bookmarked ? styles.active : ''}`}
                  onClick={handleToggleBookmark}
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
            {tabs.map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'overview' && (
              <div className={styles.overview}>
                <h3>Nội dung</h3>
                <p className={styles.description}>
                  {description}
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
                  {movie.episode_total && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Số tập</span>
                      <span>{movie.episode_current} / {movie.episode_total}</span>
                    </div>
                  )}
                </div>

                {/* Series airing schedule */}
                {movie.type === 'series' && movie.status !== 'completed' && (
                  <div className={styles.scheduleSection}>
                    <h3 className={styles.scheduleTitle}>📅 Lịch chiếu</h3>
                    <div className={styles.scheduleCard}>
                      <div className={styles.scheduleInfo}>
                        <div className={styles.scheduleRow}>
                          <span className={styles.scheduleLabel}>Tiến độ</span>
                          <span className={styles.scheduleValue}>
                            {movie.episode_current || '?'} / {movie.episode_total || '?'} tập
                          </span>
                        </div>
                        <div className={styles.progressBarSchedule}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: movie.episode_total
                                ? `${(parseInt(movie.episode_current) / parseInt(movie.episode_total)) * 100}%`
                                : '0%'
                            }}
                          />
                        </div>
                        <div className={styles.scheduleRow}>
                          <span className={styles.scheduleLabel}>Trạng thái</span>
                          <span className={`${styles.scheduleValue} ${styles.statusOngoing}`}>
                            🔴 Đang phát sóng
                          </span>
                        </div>
                        <div className={styles.scheduleRow}>
                          <span className={styles.scheduleLabel}>Cập nhật</span>
                          <span className={styles.scheduleValue}>Hàng tuần</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
                        onClick={() => navigate(`/watch/${slug}?ep=${i}`)}
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
                {directorList.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Đạo diễn</h4>
                    <div className={styles.castGrid}>
                      {directorList.map((name, i) => (
                        <div key={i} className={styles.castItem}>
                          <div className={styles.castAvatar} style={{ background: nameToColor(name) }}>
                            {(name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.castInfo}>
                            <span className={styles.castName}>{name}</span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Đạo diễn</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {castList.length > 0 ? (
                  <div>
                    {directorList.length > 0 && (
                      <h4 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Diễn viên</h4>
                    )}
                    <div className={styles.castGrid}>
                      {castList.map((actor, i) => (
                        <div key={i} className={styles.castItem}>
                          <div className={styles.castAvatar} style={{ background: nameToColor(actor.name) }}>
                            {actor.photo ? (
                              <img src={actor.photo} alt={actor.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              (actor.name || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className={styles.castInfo}>
                            <span className={styles.castName}>{actor.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
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
