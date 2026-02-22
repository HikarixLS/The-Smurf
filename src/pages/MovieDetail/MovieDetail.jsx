import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPlay, FiHeart, FiBookmark, FiShare2, FiStar, FiClock, FiCalendar, FiImage, FiTag } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieRow from '@/components/home/MovieRow/MovieRow';
import Loader from '@/components/common/Loader/Loader';
import { movieService } from '@/services/api/movieService';
import { getImageUrl, stripHtml } from '@/utils/helpers';
import styles from './MovieDetail.module.css';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

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
  // New TMDB data
  const [tmdbImages, setTmdbImages] = useState(null);
  const [tmdbPeoples, setTmdbPeoples] = useState(null);
  const [tmdbKeywords, setTmdbKeywords] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

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

        // Fetch TMDB data + related movies in parallel
        const [catRes, imgRes, peopleRes, kwRes] = await Promise.allSettled([
          response.data.item.category?.length > 0
            ? movieService.getMoviesByCategory(response.data.item.category[0].slug, 1)
            : Promise.resolve(null),
          movieService.getMovieImages(slug),
          movieService.getMoviePeoples(slug),
          movieService.getMovieKeywords(slug),
        ]);

        if (catRes.status === 'fulfilled' && catRes.value?.data?.items) {
          setRelatedMovies(catRes.value.data.items.filter(m => m.slug !== slug));
        }
        if (imgRes.status === 'fulfilled' && imgRes.value?.data?.images) {
          setTmdbImages(imgRes.value.data.images);
        }
        if (peopleRes.status === 'fulfilled' && peopleRes.value?.data) {
          setTmdbPeoples(peopleRes.value.data);
        }
        if (kwRes.status === 'fulfilled' && kwRes.value?.data?.keywords) {
          setTmdbKeywords(kwRes.value.data.keywords);
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

  // Build tabs dynamically
  const tabs = ['overview', 'episodes', 'cast'];
  if (tmdbImages?.backdrops?.length > 0 || tmdbImages?.posters?.length > 0) tabs.push('gallery');
  tabs.push('related');

  const tabLabels = {
    overview: 'Tổng quan',
    episodes: 'Tập phim',
    cast: 'Diễn viên',
    gallery: 'Hình ảnh',
    related: 'Đề xuất',
  };

  // Merge cast data: TMDB peoples (with photos) + fallback to movie.actor
  const castList = tmdbPeoples?.cast?.length > 0
    ? tmdbPeoples.cast.slice(0, 20)
    : movie.actor?.map(name => ({ name, profile_path: null })) || [];

  const crewList = tmdbPeoples?.crew?.filter(c => c.job === 'Director') || [];

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
              <h1 className={styles.title}>{movie.origin_name || movie.name}</h1>
              {movie.origin_name && movie.name !== movie.origin_name && (
                <p className={styles.originName}>{movie.name}</p>
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

              {/* Keywords from TMDB */}
              {tmdbKeywords?.length > 0 && (
                <div className={styles.keywords}>
                  <FiTag className={styles.keywordsIcon} />
                  {tmdbKeywords.slice(0, 6).map((kw, i) => (
                    <span key={i} className={styles.keywordTag}>
                      {kw.name_vn || kw.name}
                    </span>
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
                  {movie.content ? stripHtml(movie.content) : 'Đang cập nhật...'}
                </p>

                <div className={styles.detailGrid}>
                  {movie.country?.length > 0 && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Quốc gia</span>
                      <span>{movie.country.map(c => c.name).join(', ')}</span>
                    </div>
                  )}
                  {/* Show directors from TMDB if available, else fallback */}
                  {(crewList.length > 0 || movie.director?.length > 0) && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Đạo diễn</span>
                      <span>
                        {crewList.length > 0
                          ? crewList.map(d => d.name).join(', ')
                          : movie.director.join(', ')}
                      </span>
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
                {castList.length > 0 ? (
                  <div className={styles.castGrid}>
                    {castList.map((actor, i) => (
                      <div key={i} className={styles.castItem}>
                        {actor.profile_path ? (
                          <img
                            src={`${TMDB_IMG}/w185${actor.profile_path}`}
                            alt={actor.name}
                            className={styles.castPhoto}
                          />
                        ) : (
                          <div className={styles.castAvatar}>
                            {(actor.name || '?').charAt(0)}
                          </div>
                        )}
                        <div className={styles.castInfo}>
                          <span className={styles.castName}>{actor.name}</span>
                          {actor.character && (
                            <span className={styles.castRole}>{actor.character}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.empty}>Đang cập nhật...</p>
                )}
              </div>
            )}

            {activeTab === 'gallery' && (
              <div className={styles.gallerySection}>
                {tmdbImages?.backdrops?.length > 0 && (
                  <>
                    <h3 className={styles.galleryTitle}>
                      <FiImage /> Ảnh nền ({tmdbImages.backdrops.length})
                    </h3>
                    <div className={styles.galleryGrid}>
                      {tmdbImages.backdrops.slice(0, 12).map((img, i) => (
                        <div
                          key={i}
                          className={styles.galleryItem}
                          onClick={() => setSelectedImage(`${TMDB_IMG}/original${img.file_path}`)}
                        >
                          <img
                            src={`${TMDB_IMG}/w500${img.file_path}`}
                            alt={`Backdrop ${i + 1}`}
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {tmdbImages?.posters?.length > 0 && (
                  <>
                    <h3 className={styles.galleryTitle}>
                      <FiImage /> Poster ({tmdbImages.posters.length})
                    </h3>
                    <div className={styles.posterGrid}>
                      {tmdbImages.posters.slice(0, 8).map((img, i) => (
                        <div
                          key={i}
                          className={styles.galleryItem}
                          onClick={() => setSelectedImage(`${TMDB_IMG}/original${img.file_path}`)}
                        >
                          <img
                            src={`${TMDB_IMG}/w342${img.file_path}`}
                            alt={`Poster ${i + 1}`}
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Lightbox */}
                {selectedImage && (
                  <div className={styles.lightbox} onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} alt="Full size" />
                    <button className={styles.lightboxClose}>✕</button>
                  </div>
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
