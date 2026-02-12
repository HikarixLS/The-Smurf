import apiClient from './client';
import ENDPOINTS from './endpoints';

// Search Service
export const searchService = {
  /**
   * Search movies by keyword
   * @param {string} keyword - Search keyword
   * @param {number} limit - Number of results
   * @returns {Promise} - Search results
   */
  searchMovies: async (keyword, limit = 20) => {
    try {
      if (!keyword || keyword.trim() === '') {
        return { data: { items: [] } };
      }

      const params = new URLSearchParams({
        keyword: keyword.trim(),
        limit: limit.toString(),
      });

      const response = await apiClient.get(`${ENDPOINTS.SEARCH}?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error searching movies:', error);
      throw error;
    }
  },

  /**
   * Get search suggestions for autocomplete
   * @param {string} keyword - Search keyword
   * @param {number} limit - Number of suggestions
   * @returns {Promise} - Search suggestions
   */
  getSearchSuggestions: async (keyword, limit = 5) => {
    try {
      if (!keyword || keyword.trim() === '' || keyword.length < 2) {
        return { data: { items: [] } };
      }

      const params = new URLSearchParams({
        keyword: keyword.trim(),
        limit: limit.toString(),
      });

      const response = await apiClient.get(`${ENDPOINTS.SEARCH}?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      // Don't throw error for autocomplete, just return empty
      return { data: { items: [] } };
    }
  },
};

export default searchService;
