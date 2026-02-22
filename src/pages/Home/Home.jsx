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
  const [theaterMovies, setTheaterMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Try the optimized single /home endpoint first
      let homeSuccess = false;
      try {
        const homeRes = await movieService.getHomeData();
        if (homeRes?.data?.items) {
          const items = homeRes.data.items;
          setFeaturedMovies(items.slice(0, 8));
          setNewMovies(items);
          homeSuccess = true;
        }
      } catch {
        // /home endpoint not available, fall back to individual calls
      }

      // Fetch series, single, and theater movies
      const calls = [
        movieService.getSeries(1, 24),
        movieService.getSingleMovies(1, 24),
        movieService.getMoviesByCategory('hanh-dong', 1, 'modified.time'), // Theater-like action movies
      ];
      if (!homeSuccess) {
        calls.push(movieService.getNewReleases(1, 24));
      }

      const results = await Promise.allSettled(calls);

      if (results[0].status === 'fulfilled' && results[0].value?.data?.items) {
        setSeriesMovies(results[0].value.data.items);
      }

      if (results[1].status === 'fulfilled' && results[1].value?.data?.items) {
        setSingleMovies(results[1].value.data.items);
      }

      if (results[2].status === 'fulfilled' && results[2].value?.data?.items) {
        setTheaterMovies(results[2].value.data.items);
      }

      // Fallback: if /home didn't work, use individual new releases call
      if (!homeSuccess && results[3]?.status === 'fulfilled' && results[3].value?.data?.items) {
        const items = results[3].value.data.items;
        setFeaturedMovies(items.slice(0, 8));
        setNewMovies(items);
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
            title="Phim Chiếu Rạp"
            movies={theaterMovies}
            loading={loading}
            linkTo="/browse?type=hoathinh"
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

