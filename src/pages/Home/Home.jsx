import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import HeroBanner from '@/components/home/HeroBanner/HeroBanner';
import MovieRow from '@/components/home/MovieRow/MovieRow';
import { movieService } from '@/services/api/movieService';
import styles from './Home.module.css';

const Home = () => {
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [newMovies, setNewMovies] = useState([]);
  const [seriesMovies, setSeriesMovies] = useState([]);
  const [singleMovies, setSingleMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [newRes, seriesRes, singleRes] = await Promise.allSettled([
        movieService.getNewReleases(1, 24),
        movieService.getSeries(1, 24),
        movieService.getSingleMovies(1, 24),
      ]);

      if (newRes.status === 'fulfilled' && newRes.value?.data?.items) {
        const items = newRes.value.data.items;
        setFeaturedMovies(items.slice(0, 8));
        setNewMovies(items);
      }

      if (seriesRes.status === 'fulfilled' && seriesRes.value?.data?.items) {
        setSeriesMovies(seriesRes.value.data.items);
      }

      if (singleRes.status === 'fulfilled' && singleRes.value?.data?.items) {
        setSingleMovies(singleRes.value.data.items);
      }
    } catch (err) {
      console.error('Error fetching home data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className={styles.home}>
        <HeroBanner movies={featuredMovies} />

        <div className={styles.sections}>
          <MovieRow
            title="Phim Mới Cập Nhật"
            movies={newMovies}
            loading={loading}
            linkTo="/browse"
          />

          <MovieRow
            title="Phim Bộ Mới"
            movies={seriesMovies}
            loading={loading}
            linkTo="/browse?type=series"
          />

          <MovieRow
            title="Phim Lẻ Mới"
            movies={singleMovies}
            loading={loading}
            linkTo="/browse?type=single"
          />
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Home;
