import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter, FiX, FiArrowDown, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieGrid from '@/components/movie/MovieGrid/MovieGrid';
import { movieService } from '@/services/api/movieService';
import styles from './Browse.module.css';

const ITEMS_PER_PAGE = 16;

const TYPES = [
  { name: 'Tất cả', value: '' },
  { name: 'Phim lẻ', value: 'single' },
  { name: 'Phim bộ', value: 'series' },
  { name: 'Hoạt hình', value: 'hoathinh' },
  { name: 'TV Shows', value: 'tvshows' },
];

const SORT_OPTIONS = [
  { name: 'Mới cập nhật', value: 'modified.time' },
  { name: 'Năm sản xuất', value: 'year' },
  { name: 'Tên phim', value: '_id' },
];

// Fallback year list — always generate recent 25 years
const generateFallbackYears = () =>
  Array.from({ length: 25 }, (_, i) => {
    const y = new Date().getFullYear() - i;
    return { name: y.toString(), slug: y.toString() };
  });

const Browse = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  // Collapsible filter sections
  const [expandedSections, setExpandedSections] = useState({
    type: true,
    genre: true,
    country: false,
    year: false,
  });

  // Dynamic filter lists from API
  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [years, setYears] = useState(generateFallbackYears());
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const type = searchParams.get('type') || '';
  const genre = searchParams.get('genre') || '';
  const country = searchParams.get('country') || '';
  const year = searchParams.get('year') || '';
  const sort = searchParams.get('sort') || 'modified.time';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Auto-expand sections with active filters
  useEffect(() => {
    setExpandedSections(prev => ({
      ...prev,
      type: true,
      genre: prev.genre || !!genre,
      country: prev.country || !!country,
      year: prev.year || !!year,
    }));
  }, [genre, country, year]);

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
          const raw = yearRes.value;
          let items = raw?.data?.items || raw?.items || raw?.data || [];
          if (Array.isArray(items) && items.length > 0) {
            const normalizedYears = items.map(y => {
              if (typeof y === 'number' || typeof y === 'string') {
                return { name: y.toString(), slug: y.toString() };
              }
              return {
                name: (y.year || y.name || y.slug || '').toString(),
                slug: (y.year || y.slug || y.name || '').toString(),
              };
            }).filter(y => y.name && y.name !== 'undefined');

            if (normalizedYears.length > 0) {
              setYears(normalizedYears);
            }
          }
        }
      } catch (e) {
        console.error('Error loading filters:', e);
      } finally {
        setFiltersLoaded(true);
      }
    };
    fetchFilters();
  }, []);

  // Fetch movies when filters or page change
  // Priority: genre > country > year > type-only (matching API routing)
  // All endpoints support cross-filtering per API docs
  const fetchMovies = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    setMovies([]); // Clear old results immediately when fetching new data
    try {
      let response;
      if (genre) {
        // /v1/api/the-loai/[slug] supports: type, country, year as cross-filters
        response = await movieService.getMoviesByCategory(genre, p, sort, ITEMS_PER_PAGE, { type, country, year });
      } else if (country) {
        // /v1/api/quoc-gia/[slug] supports: type, category, year as cross-filters
        response = await movieService.getMoviesByCountry(country, p, sort, ITEMS_PER_PAGE, { type, year });
      } else if (year) {
        // /v1/api/nam-phat-hanh/[year] supports: type, category, country as cross-filters
        response = await movieService.getMoviesByYear(year, p, sort, ITEMS_PER_PAGE, { type, country });
      } else {
        // /v1/api/danh-sach/[slug] — type only (phim-bo, phim-le, hoat-hinh, tv-shows)
        response = await movieService.getMovies(p, { type, limit: ITEMS_PER_PAGE }, sort);
      }

      const items = response?.data?.items ?? [];
      setMovies(items);

      const pagination = response?.data?.params?.pagination;
      if (pagination) {
        setTotalPages(pagination.totalPages || Math.ceil(pagination.totalItems / (pagination.totalItemsPerPage || ITEMS_PER_PAGE)));
      } else {
        setTotalPages(1);
      }
    } catch (err) {
      setError('Lỗi tải danh sách phim');
    } finally {
      setLoading(false);
    }
  }, [type, genre, country, year, sort]);

  useEffect(() => {
    fetchMovies(page);
  }, [fetchMovies, page]);

  const goToPage = useCallback((newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, setSearchParams]);

  // Allow combining filters (no mutual exclusion)
  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    params.delete('page');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const hasActiveFilters = type || genre || country || year;

  const getTitle = () => {
    const parts = [];
    if (type) {
      const found = TYPES.find(t => t.value === type);
      if (found) parts.push(found.name);
    }
    if (genre) {
      const found = genres.find(g => g.slug === genre);
      parts.push(found ? found.name : 'Thể loại');
    }
    if (country) {
      const found = countries.find(c => c.slug === country);
      parts.push(found ? found.name : 'Quốc gia');
    }
    if (year) parts.push(`Năm ${year}`);
    return parts.length > 0 ? parts.join(' • ') : 'Danh mục phim';
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
                <button className={styles.filterLabel} onClick={() => toggleSection('type')}>
                  Loại phim
                  {expandedSections.type ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </button>
                {expandedSections.type && (
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
                )}
              </div>

              {/* Genre filter - dynamic from API */}
              <div className={styles.filterGroup}>
                <button className={styles.filterLabel} onClick={() => toggleSection('genre')}>
                  Thể loại {genre && <span className={styles.activeIndicator}>•</span>}
                  {expandedSections.genre ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </button>
                {expandedSections.genre && (
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
                )}
              </div>

              {/* Country filter - dynamic from API */}
              <div className={styles.filterGroup}>
                <button className={styles.filterLabel} onClick={() => toggleSection('country')}>
                  Quốc gia {country && <span className={styles.activeIndicator}>•</span>}
                  {expandedSections.country ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </button>
                {expandedSections.country && (
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
                )}
              </div>

              {/* Year filter */}
              <div className={styles.filterGroup}>
                <button className={styles.filterLabel} onClick={() => toggleSection('year')}>
                  Năm {year && <span className={styles.activeIndicator}>•</span>}
                  {expandedSections.year ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </button>
                {expandedSections.year && (
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
                  </div>
                )}
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
            currentPage={page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Browse;
