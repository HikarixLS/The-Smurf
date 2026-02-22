import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter, FiX, FiArrowDown, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieGrid from '@/components/movie/MovieGrid/MovieGrid';
import { movieService } from '@/services/api/movieService';
import styles from './Browse.module.css';

const TYPES = [
  { name: 'Tất cả', value: '' },
  { name: 'Phim lẻ', value: 'single' },
  { name: 'Phim bộ', value: 'series' },
  { name: 'Phim chiếu rạp', value: 'hoathinh' },
];

const SORT_OPTIONS = [
  { name: 'Mới cập nhật', value: 'modified.time' },
  { name: 'Năm sản xuất', value: 'year' },
  { name: 'Tên phim', value: '_id' },
];

// Extra genres to inject if not already present
const EXTRA_GENRES = [
  { name: 'Bách Hợp', slug: 'bach-hop' },
  { name: 'Đam Mỹ', slug: 'dam-my' },
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // Collapsible filter sections
  const [expandedSections, setExpandedSections] = useState({
    type: true,
    genre: false,
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
          let items = catRes.value?.data?.items || catRes.value?.items || [];
          // Inject extra genres if not present
          EXTRA_GENRES.forEach(extra => {
            if (!items.find(g => g.slug === extra.slug)) {
              items = [...items, extra];
            }
          });
          setGenres(items);
        }
        if (countryRes.status === 'fulfilled') {
          const items = countryRes.value?.data?.items || countryRes.value?.items || [];
          setCountries(items);
        }
        if (yearRes.status === 'fulfilled') {
          // Try multiple parsing strategies for API response
          const raw = yearRes.value;
          let items = raw?.data?.items || raw?.items || raw?.data || [];
          // If it's directly an array of numbers
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

      // Priority: genre > country > year > type
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
        let items = response.data.items;

        // Client-side year filter when using genre/country endpoint
        if (year && (genre || country)) {
          items = items.filter(m => m.year && m.year.toString() === year);
        }

        if (p === 1) {
          setMovies(items);
        } else {
          setMovies(prev => [...prev, ...items]);
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

  // Allow combining filters (no mutual exclusion)
  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
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
    if (genre) {
      const found = genres.find(g => g.slug === genre);
      parts.push(found ? found.name : 'Thể loại');
    }
    if (country) {
      const found = countries.find(c => c.slug === country);
      parts.push(found ? found.name : 'Quốc gia');
    }
    if (year) parts.push(`Năm ${year}`);
    if (type === 'single') parts.push('Phim lẻ');
    if (type === 'series') parts.push('Phim bộ');
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

              {/* Year filter - always shows fallback years */}
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

