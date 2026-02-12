import apiClient from './client';
import ENDPOINTS from './endpoints';

// Movie Service
export const movieService = {
  /**
   * Get list of movies with pagination and filters
   * @param {number} page - Page number
   * @param {object} filters - Filter options (type, category, country, year)
   * @returns {Promise} - Movie list
   */
  getMovies: async (page = 1, filters = {}) => {
    try {
      const params = new URLSearchParams({ page: page.toString() });

      // Add filters if provided
      if (filters.type) params.append('type', filters.type);
      if (filters.category) params.append('category', filters.category);
      if (filters.country) params.append('country', filters.country);
      if (filters.year) params.append('year', filters.year);

      const endpoint = filters.type === 'series' ? ENDPOINTS.MOVIES_SERIES :
                       filters.type === 'single' ? ENDPOINTS.MOVIES_SINGLE :
                       ENDPOINTS.MOVIES_NEW;

      const response = await apiClient.get(`${endpoint}?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching movies:', error);
      throw error;
    }
  },

  /**
   * Get movie details by slug
   * @param {string} slug - Movie slug
   * @returns {Promise} - Movie details
   */
  getMovieDetail: async (slug) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIE_DETAIL}/${slug}`);
      return response;
    } catch (error) {
      console.error('Error fetching movie detail:', error);
      throw error;
    }
  },

  /**
   * Get featured/trending movies
   * @returns {Promise} - Featured movies
   */
  getFeaturedMovies: async () => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIES_NEW}?page=1&limit=10`);
      return response;
    } catch (error) {
      console.error('Error fetching featured movies:', error);
      throw error;
    }
  },

  /**
   * Get movies by category
   * @param {string} categorySlug - Category slug
   * @param {number} page - Page number
   * @returns {Promise} - Movies by category
   */
  getMoviesByCategory: async (categorySlug, page = 1) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.CATEGORY}/${categorySlug}?page=${page}`);
      return response;
    } catch (error) {
      console.error('Error fetching movies by category:', error);
      throw error;
    }
  },

  /**
   * Get movies by country
   * @param {string} countrySlug - Country slug
   * @param {number} page - Page number
   * @returns {Promise} - Movies by country
   */
  getMoviesByCountry: async (countrySlug, page = 1) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.COUNTRY}/${countrySlug}?page=${page}`);
      return response;
    } catch (error) {
      console.error('Error fetching movies by country:', error);
      throw error;
    }
  },

  /**
   * Get movies by year
   * @param {number} year - Year
   * @param {number} page - Page number
   * @returns {Promise} - Movies by year
   */
  getMoviesByYear: async (year, page = 1) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.YEAR}/${year}?page=${page}`);
      return response;
    } catch (error) {
      console.error('Error fetching movies by year:', error);
      throw error;
    }
  },

  /**
   * Get new releases
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise} - New releases
   */
  getNewReleases: async (page = 1, limit = 24) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIES_NEW}?page=${page}&limit=${limit}`);
      return response;
    } catch (error) {
      console.error('Error fetching new releases:', error);
      throw error;
    }
  },

  /**
   * Get series movies
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise} - Series movies
   */
  getSeries: async (page = 1, limit = 24) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIES_SERIES}?page=${page}&limit=${limit}`);
      return response;
    } catch (error) {
      console.error('Error fetching series:', error);
      throw error;
    }
  },

  /**
   * Get single movies
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise} - Single movies
   */
  getSingleMovies: async (page = 1, limit = 24) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIES_SINGLE}?page=${page}&limit=${limit}`);
      return response;
    } catch (error) {
      console.error('Error fetching single movies:', error);
      throw error;
    }
  },
};

export default movieService;
