import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiFilter, FiX } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieGrid from '@/components/movie/MovieGrid/MovieGrid';
import { movieService } from '@/services/api/movieService';
import styles from './Browse.module.css';

const GENRES = [
  { name: 'Tất cả', slug: '' },
  { name: 'Hành Động', slug: 'hanh-dong' },
  { name: 'Tình Cảm', slug: 'tinh-cam' },
  { name: 'Hài Hước', slug: 'hai-huoc' },
  { name: 'Kinh Dị', slug: 'kinh-di' },
  { name: 'Viễn Tưởng', slug: 'vien-tuong' },
  { name: 'Phiêu Lưu', slug: 'phieu-luu' },
  { name: 'Hình Sự', slug: 'hinh-su' },
  { name: 'Hoạt Hình', slug: 'hoat-hinh' },
  { name: 'Tâm Lý', slug: 'tam-ly' },
  { name: 'Chiến Tranh', slug: 'chien-tranh' },
];

const COUNTRIES = [
  { name: 'Tất cả', slug: '' },
  { name: 'Hàn Quốc', slug: 'han-quoc' },
  { name: 'Trung Quốc', slug: 'trung-quoc' },
  { name: 'Nhật Bản', slug: 'nhat-ban' },
  { name: 'Thái Lan', slug: 'thai-lan' },
  { name: 'Âu Mỹ', slug: 'au-my' },
  { name: 'Việt Nam', slug: 'viet-nam' },
  { name: 'Đài Loan', slug: 'dai-loan' },
  { name: 'Ấn Độ', slug: 'an-do' },
];

const YEARS = [
  { name: 'Tất cả', value: '' },
  ...Array.from({ length: 10 }, (_, i) => {
    const y = new Date().getFullYear() - i;
    return { name: y.toString(), value: y.toString() };
  }),
];

const TYPES = [
  { name: 'Tất cả', value: '' },
  { name: 'Phim lẻ', value: 'single' },
  { name: 'Phim bộ', value: 'series' },
];

const Browse = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const type = searchParams.get('type') || '';
  const genre = searchParams.get('genre') || '';
  const country = searchParams.get('country') || '';
  const year = searchParams.get('year') || '';

  useEffect(() => {
    setMovies([]);
    setPage(1);
    fetchMovies(1);
  }, [type, genre, country, year]);

  const fetchMovies = async (p) => {
    setLoading(true);
    setError(null);
    try {
      let response;

      if (genre) {
        response = await movieService.getMoviesByCategory(genre, p);
      } else if (country) {
        response = await movieService.getMoviesByCountry(country, p);
      } else if (year) {
        response = await movieService.getMoviesByYear(year, p);
      } else {
        response = await movieService.getMovies(p, { type });
      }

      if (response?.data?.items) {
        if (p === 1) {
          setMovies(response.data.items);
        } else {
          setMovies(prev => [...prev, ...response.data.items]);
        }
        const pagination = response.data.params?.pagination;
        if (pagination) {
          setHasMore(pagination.currentPage < pagination.totalPages);
        }
      }
    } catch (err) {
      setError('Lỗi tải danh sách phim');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMovies(nextPage);
  };

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      // Clear other filter types when selecting a specific filter
      if (key === 'genre') { params.delete('country'); params.delete('year'); }
      if (key === 'country') { params.delete('genre'); params.delete('year'); }
      if (key === 'year') { params.delete('genre'); params.delete('country'); }
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasActiveFilters = type || genre || country || year;

  const getTitle = () => {
    if (genre) return GENRES.find(g => g.slug === genre)?.name || 'Thể loại';
    if (country) return COUNTRIES.find(c => c.slug === country)?.name || 'Quốc gia';
    if (year) return `Năm ${year}`;
    if (type === 'single') return 'Phim lẻ';
    if (type === 'series') return 'Phim bộ';
    return 'Danh mục phim';
  };

  return (
    <>
      <Header />
      <main className={styles.browse}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>{getTitle()}</h1>
            <button
              className={styles.filterToggle}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter /> Bộ lọc
            </button>
          </div>

          {showFilters && (
            <div className={styles.filtersPanel}>
              {/* Type filter */}
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Loại phim</span>
                <div className={styles.filterOptions}>
                  {TYPES.map(t => (
                    <button
                      key={t.value}
                      className={`${styles.filterChip} ${type === t.value ? styles.chipActive : ''}`}
                      onClick={() => updateFilter('type', t.value)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre filter */}
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Thể loại</span>
                <div className={styles.filterOptions}>
                  {GENRES.map(g => (
                    <button
                      key={g.slug}
                      className={`${styles.filterChip} ${genre === g.slug ? styles.chipActive : ''}`}
                      onClick={() => updateFilter('genre', g.slug)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country filter */}
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Quốc gia</span>
                <div className={styles.filterOptions}>
                  {COUNTRIES.map(c => (
                    <button
                      key={c.slug}
                      className={`${styles.filterChip} ${country === c.slug ? styles.chipActive : ''}`}
                      onClick={() => updateFilter('country', c.slug)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year filter */}
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Năm</span>
                <div className={styles.filterOptions}>
                  {YEARS.map(y => (
                    <button
                      key={y.value}
                      className={`${styles.filterChip} ${year === y.value ? styles.chipActive : ''}`}
                      onClick={() => updateFilter('year', y.value)}
                    >
                      {y.name}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button className={styles.clearBtn} onClick={clearFilters}>
                  <FiX /> Xóa bộ lọc
                </button>
              )}
            </div>
          )}

          <MovieGrid
            movies={movies}
            loading={loading}
            error={error}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Browse;
