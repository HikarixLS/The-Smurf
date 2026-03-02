import React from 'react';
import PropTypes from 'prop-types';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import MovieCard from '../MovieCard/MovieCard';
import Loader from '@/components/common/Loader/Loader';
import styles from './MovieGrid.module.css';

const MovieGrid = ({
  movies = [],
  loading = false,
  error = null,
  currentPage = 1,
  totalPages = 1,
  onPageChange = null,
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

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);

      let start = Math.max(2, currentPage - 2);
      let end = Math.min(totalPages - 1, currentPage + 2);

      // Adjust range to always show maxVisible - 2 middle pages
      if (currentPage <= 3) {
        end = Math.min(totalPages - 1, 5);
      } else if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - 4);
      }

      if (start > 2) pages.push('...');

      for (let i = start; i <= end; i++) pages.push(i);

      if (end < totalPages - 1) pages.push('...');

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <>
      <div className={styles.movieGrid}>
        {movies.map((movie) => (
          <MovieCard key={movie._id || movie.slug} movie={movie} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className={styles.pagination}>
          <button
            className={`${styles.pageBtn} ${styles.navBtn}`}
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="Trang đầu"
          >
            <FiChevronsLeft size={16} />
          </button>
          <button
            className={`${styles.pageBtn} ${styles.navBtn}`}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Trang trước"
          >
            <FiChevronLeft size={16} />
          </button>

          {getPageNumbers().map((pageNum, idx) =>
            pageNum === '...' ? (
              <span key={`ellipsis-${idx}`} className={styles.ellipsis}>…</span>
            ) : (
              <button
                key={pageNum}
                className={`${styles.pageBtn} ${pageNum === currentPage ? styles.pageActive : ''}`}
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </button>
            )
          )}

          <button
            className={`${styles.pageBtn} ${styles.navBtn}`}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Trang sau"
          >
            <FiChevronRight size={16} />
          </button>
          <button
            className={`${styles.pageBtn} ${styles.navBtn}`}
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="Trang cuối"
          >
            <FiChevronsRight size={16} />
          </button>
        </div>
      )}
    </>
  );
};

MovieGrid.propTypes = {
  movies: PropTypes.array,
  loading: PropTypes.bool,
  error: PropTypes.string,
  currentPage: PropTypes.number,
  totalPages: PropTypes.number,
  onPageChange: PropTypes.func,
};

export default MovieGrid;
