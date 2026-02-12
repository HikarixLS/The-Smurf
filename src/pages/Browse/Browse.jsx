import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieGrid from '@/components/movie/MovieGrid/MovieGrid';
import useMovies from '@/hooks/useMovies';
import styles from './Browse.module.css';

const Browse = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get('type') || '';

  const filters = {
    type: type,
  };

  const { movies, loading, error, hasMore, loadMore } = useMovies(1, filters);

  const handleTypeChange = (newType) => {
    if (newType) {
      setSearchParams({ type: newType });
    } else {
      setSearchParams({});
    }
  };

  return (
    <>
      <Header />
      <main className={styles.browse}>
        <div className="container">
          <h1 className={styles.title}>Danh mục phim</h1>

          <div className={styles.filters}>
            <button
              className={`${styles.filterBtn} ${!type ? styles.active : ''}`}
              onClick={() => handleTypeChange('')}
            >
              Tất cả
            </button>
            <button
              className={`${styles.filterBtn} ${type === 'single' ? styles.active : ''}`}
              onClick={() => handleTypeChange('single')}
            >
              Phim lẻ
            </button>
            <button
              className={`${styles.filterBtn} ${type === 'series' ? styles.active : ''}`}
              onClick={() => handleTypeChange('series')}
            >
              Phim bộ
            </button>
          </div>

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
