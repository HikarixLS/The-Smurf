import React, { useEffect } from 'react';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import MovieGrid from '@/components/movie/MovieGrid/MovieGrid';
import useMovies from '@/hooks/useMovies';
import styles from './Home.module.css';

const Home = () => {
  const { movies, loading, error, hasMore, loadMore } = useMovies(1);

  return (
    <>
      <Header />
      <main className={styles.home}>
        <div className="container">
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Phim Mới Cập Nhật</h2>
            <MovieGrid
              movies={movies}
              loading={loading}
              error={error}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Home;
