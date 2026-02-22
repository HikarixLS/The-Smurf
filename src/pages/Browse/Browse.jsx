import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter, FiX, FiArrowDown } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieGrid from '@/components/movie/MovieGrid/MovieGrid';
import { movieService } from '@/services/api/movieService';
import styles from './Browse.module.css';

const TYPES = [
  { name: 'Tất cả', value: '' },
  { name: 'Phim lẻ', value: 'single' },
  { name: 'Phim bộ', value: 'series' },
];

const SORT_OPTIONS = [
  { name: 'Mới cập nhật', value: 'modified.time' },
  { name: 'Năm sản xuất', value: 'year' },
  { name: 'Tên phim', value: '_id' },
];

const Browse = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // Dynamic filter lists from API
  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [years, setYears] = useState([]);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const type = searchParams.get('type') || '';
  const genre = searchParams.get('genre') || '';
  const country = searchParams.get('country') || '';
  const year = searchParams.get('year') || '';
  const sort = searchParams.get('sort') || 'modified.time';

  // Fetch filter lists from API on mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [catRes, countryRes, yearRes] = await Promise.allSettled([
          movieService.getCategories(),
          movieService.getCountries(),
          movieService.getYears(),
        ]);

        if (catRes.status === 'fulfilled') {
          const items = catRes.value?.data?.items || catRes.value?.items || [];
          setGenres(items);
        }
        if (countryRes.status === 'fulfilled') {
          const items = countryRes.value?.data?.items || countryRes.value?.items || [];
          setCountries(items);
        }
        if (yearRes.status === 'fulfilled') {
          const items = yearRes.value?.data?.items || yearRes.value?.items || [];
          setYears(items);
        }
      } catch (e) {
        console.error('Error loading filters:', e);
      } finally {
        setFiltersLoaded(true);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    setMovies([]);
    setPage(1);
    fetchMovies(1);
  }, [type, genre, country, year, sort]);

  const fetchMovies = async (p) => {
    setLoading(true);
    setError(null);
    try {
      let response;

      if (genre) {
        response = await movieService.getMoviesByCategory(genre, p, sort);
      } else if (country) {
        response = await movieService.getMoviesByCountry(country, p, sort);
      } else if (year) {
        response = await movieService.getMoviesByYear(year, p, sort);
      } else {
        response = await movieService.getMovies(p, { type }, sort);
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
    if (genre) {
      const found = genres.find(g => g.slug === genre);
      return found ? found.name : 'Thể loại';
    }
    if (country) {
      const found = countries.find(c => c.slug === country);
      return found ? found.name : 'Quốc gia';
    }
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
            <div className={styles.headerActions}>
              {/* Sort dropdown */}
              <div className={styles.sortWrapper}>
                <FiArrowDown className={styles.sortIcon} />
                <select
                  className={styles.sortSelect}
                  value={sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                >
                  {SORT_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.name}</option>
                  ))}
                </select>
              </div>
              <button
                className={styles.filterToggle}
                onClick={() => setShowFilters(!showFilters)}
              >
                <FiFilter /> Bộ lọc
              </button>
            </div>
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

              {/* Genre filter - dynamic from API */}
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Thể loại</span>
                <div className={styles.filterOptions}>
                  <button
                    className={`${styles.filterChip} ${!genre ? styles.chipActive : ''}`}
                    onClick={() => updateFilter('genre', '')}
                  >
                    Tất cả
                  </button>
                  {genres.map(g => (
                    <button
                      key={g.slug}
                      className={`${styles.filterChip} ${genre === g.slug ? styles.chipActive : ''}`}
                      onClick={() => updateFilter('genre', g.slug)}
                    >
                      {g.name}
                    </button>
                  ))}
                  {!filtersLoaded && <span className={styles.filterLoading}>Đang tải...</span>}
                </div>
              </div>

              {/* Country filter - dynamic from API */}
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Quốc gia</span>
                <div className={styles.filterOptions}>
                  <button
                    className={`${styles.filterChip} ${!country ? styles.chipActive : ''}`}
                    onClick={() => updateFilter('country', '')}
                  >
                    Tất cả
                  </button>
                  {countries.map(c => (
                    <button
                      key={c.slug}
                      className={`${styles.filterChip} ${country === c.slug ? styles.chipActive : ''}`}
                      onClick={() => updateFilter('country', c.slug)}
                    >
                      {c.name}
                    </button>
                  ))}
                  {!filtersLoaded && <span className={styles.filterLoading}>Đang tải...</span>}
                </div>
              </div>

              {/* Year filter - dynamic from API */}
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Năm</span>
                <div className={styles.filterOptions}>
                  <button
                    className={`${styles.filterChip} ${!year ? styles.chipActive : ''}`}
                    onClick={() => updateFilter('year', '')}
                  >
                    Tất cả
                  </button>
                  {years.map(y => (
                    <button
                      key={y.slug || y.name}
                      className={`${styles.filterChip} ${year === (y.slug || y.name) ? styles.chipActive : ''}`}
                      onClick={() => updateFilter('year', y.slug || y.name)}
                    >
                      {y.name}
                    </button>
                  ))}
                  {!filtersLoaded && <span className={styles.filterLoading}>Đang tải...</span>}
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
