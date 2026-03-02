import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import HeroBanner from '@/components/home/HeroBanner/HeroBanner';
import MovieRow from '@/components/home/MovieRow/MovieRow';
import { movieService } from '@/services/api/movieService';
import useSEO from '@/hooks/useSEO';
import styles from './Home.module.css';

const Home = () => {
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [newMovies, setNewMovies] = useState([]);
  const [seriesMovies, setSeriesMovies] = useState([]);
  const [singleMovies, setSingleMovies] = useState([]);
  const [animatedMovies, setAnimatedMovies] = useState([]);
  const [tvShowMovies, setTvShowMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useSEO('Trang chủ', 'Xem phim online miễn phí chất lượng cao. Phim mới, phim bộ, phim lẻ, hoạt hình cập nhật hàng ngày.');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
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
        // /home endpoint not available
      }

      const calls = [
        movieService.getSeries(1, 24),
        movieService.getSingleMovies(1, 24),
        movieService.getMovies(1, { type: 'hoathinh', limit: 24 }),
        movieService.getMovies(1, { type: 'tvshows', limit: 24 }),
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
        setAnimatedMovies(results[2].value.data.items);
      }
      if (results[3].status === 'fulfilled' && results[3].value?.data?.items) {
        setTvShowMovies(results[3].value.data.items);
      }

      if (!homeSuccess && results[4]?.status === 'fulfilled' && results[4].value?.data?.items) {
        const items = results[4].value.data.items;
        setFeaturedMovies(items.slice(0, 8));
        setNewMovies(items);
      }
    } catch (err) {
      console.warn('Error fetching home data:', err);
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

          <MovieRow
            title="Hoạt Hình"
            movies={animatedMovies}
            loading={loading}
            linkTo="/browse?type=hoathinh"
          />

          <MovieRow
            title="TV Shows"
            movies={tvShowMovies}
            loading={loading}
            linkTo="/browse?type=tvshows"
          />
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Home;
