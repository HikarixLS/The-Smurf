import { useState, useCallback } from 'react';
import { searchService } from '@/services/api/searchService';
import useDebounce from './useDebounce';

/**
 * Custom hook for movie search with debounce
 * @param {number} limit - Number of results to return
 * @returns {object} - Search functions and state
 */
const useSearch = (limit = 20) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounce keyword to avoid too many API calls
  const debouncedKeyword = useDebounce(keyword, 500);

  // Search function
  const search = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await searchService.searchMovies(searchTerm, limit);

      if (response && response.data) {
        setResults(response.data.items || []);
      }
    } catch (err) {
      setError(err.message || 'Lỗi tìm kiếm');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Auto-search when debounced keyword changes
  useCallback(() => {
    if (debouncedKeyword) {
      search(debouncedKeyword);
    } else {
      setResults([]);
    }
  }, [debouncedKeyword, search]);

  const clearSearch = () => {
    setKeyword('');
    setResults([]);
    setError(null);
  };

  return {
    keyword,
    setKeyword,
    results,
    loading,
    error,
    search,
    clearSearch,
  };
};

export default useSearch;
