import React from 'react';
import PropTypes from 'prop-types';
import MovieCard from '../MovieCard/MovieCard';
import Loader from '@/components/common/Loader/Loader';
import Button from '@/components/common/Button/Button';
import styles from './MovieGrid.module.css';

const MovieGrid = ({
  movies = [],
  loading = false,
  error = null,
  hasMore = false,
  onLoadMore = null,
}) => {
  if (loading && movies.length === 0) {
    return (
      <div className={styles.loading}>
        <Loader />
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!movies || movies.length === 0) {
    return <div className={styles.empty}>Không có phim nào</div>;
  }

  return (
    <>
      <div className={styles.movieGrid}>
        {movies.map((movie) => (
          <MovieCard key={movie._id || movie.slug} movie={movie} />
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div className={styles.loadMore}>
          <Button
            onClick={onLoadMore}
            loading={loading}
            variant="secondary"
          >
            Xem thêm
          </Button>
        </div>
      )}
    </>
  );
};

MovieGrid.propTypes = {
  movies: PropTypes.array,
  loading: PropTypes.bool,
  error: PropTypes.string,
  hasMore: PropTypes.bool,
  onLoadMore: PropTypes.func,
};

export default MovieGrid;
