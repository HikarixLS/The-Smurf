import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import HeroBanner from '@/components/home/HeroBanner/HeroBanner';
import MovieRow from '@/components/home/MovieRow/MovieRow';
import { movieService } from '@/services/api/movieService';
import { isLowPerformanceMode } from '@/utils/device';
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
  const lowPerformanceMode = isLowPerformanceMode();
  const listLimit = lowPerformanceMode ? 12 : 24;
  const featuredLimit = lowPerformanceMode ? 4 : 8;

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
          setFeaturedMovies(items.slice(0, featuredLimit));
          setNewMovies(items.slice(0, listLimit));
          homeSuccess = true;
        }
      } catch {
        // /home endpoint not available
      }

      const calls = [
        movieService.getSeries(1, listLimit),
        movieService.getSingleMovies(1, listLimit),
        movieService.getMovies(1, { type: 'hoathinh', limit: listLimit }),
        movieService.getMovies(1, { type: 'tvshows', limit: listLimit }),
      ];
      if (!homeSuccess) {
        calls.push(movieService.getNewReleases(1, listLimit));
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
        setFeaturedMovies(items.slice(0, featuredLimit));
        setNewMovies(items.slice(0, listLimit));
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
            movies={newMovies.slice(0, listLimit)}
            loading={loading}
            linkTo="/browse"
          />

          <MovieRow
            title="Phim Bộ Mới"
            movies={seriesMovies.slice(0, listLimit)}
            loading={loading}
            linkTo="/browse?type=series"
          />

          <MovieRow
            title="Phim Lẻ Mới"
            movies={singleMovies.slice(0, listLimit)}
            loading={loading}
            linkTo="/browse?type=single"
          />

          <MovieRow
            title="Hoạt Hình"
            movies={animatedMovies.slice(0, listLimit)}
            loading={loading}
            linkTo="/browse?type=hoathinh"
          />

          <MovieRow
            title="TV Shows"
            movies={tvShowMovies.slice(0, listLimit)}
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
