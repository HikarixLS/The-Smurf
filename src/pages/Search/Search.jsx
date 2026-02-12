import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import SearchBar from '@/components/search/SearchBar/SearchBar';
import MovieGrid from '@/components/movie/MovieGrid/MovieGrid';
import { searchService } from '@/services/api/searchService';
import styles from './Search.module.css';

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (keyword) => {
    setLoading(true);
    setError(null);

    try {
      const response = await searchService.searchMovies(keyword, 50);
      if (response && response.data && response.data.items) {
        setResults(response.data.items);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError('Lỗi tìm kiếm, vui lòng thử lại');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className={styles.search}>
        <div className="container">
          <h1 className={styles.title}>Tìm kiếm phim</h1>
          <SearchBar autoFocus={!query} />

          {query && (
            <>
              <div className={styles.resultInfo}>
                {loading ? (
                  'Đang tìm kiếm...'
                ) : (
                  `Tìm thấy ${results.length} kết quả cho "${query}"`
                )}
              </div>

              <MovieGrid
                movies={results}
                loading={loading}
                error={error}
                hasMore={false}
              />
            </>
          )}

          {!query && (
            <div className={styles.emptyState}>
              <p>Nhập từ khóa để tìm kiếm phim</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Search;
