import { useState, useEffect } from 'react';
import { movieService } from '@/services/api/movieService';

/**
 * Custom hook for fetching movies
 * @param {number} initialPage - Initial page number
 * @param {object} filters - Filter options
 * @returns {object} - Movies data, loading state, error, and pagination functions
 */
const useMovies = (initialPage = 1, filters = {}) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchMovies();
  }, [page, filters]);

  const fetchMovies = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await movieService.getMovies(page, filters);

      if (response && response.data) {
        const newMovies = response.data.items || [];

        // Append or replace based on page
        if (page === 1) {
          setMovies(newMovies);
        } else {
          setMovies(prev => [...prev, ...newMovies]);
        }

        // Update pagination info
        const pagination = response.data.params?.pagination;
        if (pagination) {
          setTotalPages(pagination.totalPages || 1);
          setHasMore(pagination.currentPage < pagination.totalPages);
        } else {
          setHasMore(newMovies.length > 0);
        }
      }
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách phim');
      console.error('Error fetching movies:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const refetch = () => {
    setPage(1);
    setMovies([]);
    fetchMovies();
  };

  const reset = () => {
    setMovies([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  };

  return {
    movies,
    loading,
    error,
    hasMore,
    page,
    totalPages,
    loadMore,
    refetch,
    reset,
  };
};

export default useMovies;
