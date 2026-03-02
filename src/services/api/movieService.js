import apiClient from './client';
import ENDPOINTS from './endpoints';

// Movie Service
export const movieService = {
  /**
   * Get homepage data in a single call
   * @returns {Promise} - Homepage sections (new, series, single, etc.)
   */
  getHomeData: async () => {
    try {
      const response = await apiClient.get(ENDPOINTS.HOME);
      return response;
    } catch (error) {
      console.warn('Error fetching home data:', error);
      throw error;
    }
  },

  /**
   * Get list of movies with pagination, filters, and sorting
   * @param {number} page - Page number
   * @param {object} filters - Filter options (type, category, country, year)
   * @param {string} sortField - Sort field (modified.time, year, _id)
   * @returns {Promise} - Movie list
   */
  getMovies: async (page = 1, filters = {}, sortField = '') => {
    try {
      const params = new URLSearchParams({ page: page.toString() });

      if (filters.category) params.append('category', filters.category);
      if (filters.country) params.append('country', filters.country);
      if (filters.year) params.append('year', filters.year);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (sortField) params.append('sort_field', sortField);

      let endpoint;
      switch (filters.type) {
        case 'series':
          endpoint = ENDPOINTS.MOVIES_SERIES;
          break;
        case 'single':
          endpoint = ENDPOINTS.MOVIES_SINGLE;
          break;
        case 'hoathinh':
          endpoint = ENDPOINTS.MOVIES_HOATHINH;
          break;
        case 'tvshows':
          endpoint = ENDPOINTS.MOVIES_TVSHOWS;
          break;
        default:
          endpoint = ENDPOINTS.MOVIES_NEW;
      }

      const response = await apiClient.get(`${endpoint}?${params.toString()}`);
      return response;
    } catch (error) {
      console.warn('Error fetching movies:', error);
      throw error;
    }
  },

  /**
   * Get movie details by slug
   */
  getMovieDetail: async (slug) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIE_DETAIL}/${slug}`);
      return response;
    } catch (error) {
      console.warn('Error fetching movie detail:', error);
      throw error;
    }
  },

  /**
   * Get TMDB images for a movie (HD backdrops + posters)
   */
  getMovieImages: async (slug) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIE_DETAIL}/${slug}/images`);
      return response;
    } catch (error) {
      console.warn('Error fetching movie images:', error);
      return null;
    }
  },

  /**
   * Get actors/directors for a movie
   */
  getMoviePeoples: async (slug) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIE_DETAIL}/${slug}/peoples`);
      return response;
    } catch (error) {
      console.warn('Error fetching movie peoples:', error);
      return null;
    }
  },

  /**
   * Get keywords/tags for a movie
   */
  getMovieKeywords: async (slug) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIE_DETAIL}/${slug}/keywords`);
      return response;
    } catch (error) {
      console.warn('Error fetching movie keywords:', error);
      return null;
    }
  },

  /**
   * Get all categories (genres) list
   */
  getCategories: async () => {
    try {
      const response = await apiClient.get(ENDPOINTS.CATEGORIES);
      return response;
    } catch (error) {
      console.warn('Error fetching categories:', error);
      throw error;
    }
  },

  /**
   * Get all countries list
   */
  getCountries: async () => {
    try {
      const response = await apiClient.get(ENDPOINTS.COUNTRIES);
      return response;
    } catch (error) {
      console.warn('Error fetching countries:', error);
      throw error;
    }
  },

  /**
   * Get all release years list
   */
  getYears: async () => {
    try {
      const response = await apiClient.get(ENDPOINTS.YEARS);
      return response;
    } catch (error) {
      console.warn('Error fetching years:', error);
      throw error;
    }
  },

  /**
   * Get featured/trending movies
   */
  getFeaturedMovies: async () => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIES_NEW}?page=1&limit=10`);
      return response;
    } catch (error) {
      console.warn('Error fetching featured movies:', error);
      throw error;
    }
  },

  /**
   * Get movies by category with sorting
   */
  getMoviesByCategory: async (categorySlug, page = 1, sortField = '', limit = 16, type = '') => {
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (sortField) params.append('sort_field', sortField);
      if (limit) params.append('limit', limit.toString());
      if (type) params.append('type_list', type);
      const response = await apiClient.get(`${ENDPOINTS.CATEGORY}/${categorySlug}?${params.toString()}`);
      return response;
    } catch (error) {
      console.warn('Error fetching movies by category:', error);
      throw error;
    }
  },

  /**
   * Get movies by country with sorting
   */
  getMoviesByCountry: async (countrySlug, page = 1, sortField = '', limit = 16, type = '') => {
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (sortField) params.append('sort_field', sortField);
      if (limit) params.append('limit', limit.toString());
      if (type) params.append('type_list', type);
      const response = await apiClient.get(`${ENDPOINTS.COUNTRY}/${countrySlug}?${params.toString()}`);
      return response;
    } catch (error) {
      console.warn('Error fetching movies by country:', error);
      throw error;
    }
  },

  /**
   * Get movies by year with sorting
   */
  getMoviesByYear: async (year, page = 1, sortField = '', limit = 16, type = '') => {
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (sortField) params.append('sort_field', sortField);
      if (limit) params.append('limit', limit.toString());
      if (type) params.append('type_list', type);
      const response = await apiClient.get(`${ENDPOINTS.YEAR}/${year}?${params.toString()}`);
      return response;
    } catch (error) {
      console.warn('Error fetching movies by year:', error);
      throw error;
    }
  },

  /**
   * Get new releases
   */
  getNewReleases: async (page = 1, limit = 24) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIES_NEW}?page=${page}&limit=${limit}`);
      return response;
    } catch (error) {
      console.warn('Error fetching new releases:', error);
      throw error;
    }
  },

  /**
   * Get series movies
   */
  getSeries: async (page = 1, limit = 24) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIES_SERIES}?page=${page}&limit=${limit}`);
      return response;
    } catch (error) {
      console.warn('Error fetching series:', error);
      throw error;
    }
  },

  /**
   * Get single movies
   */
  getSingleMovies: async (page = 1, limit = 24) => {
    try {
      const response = await apiClient.get(`${ENDPOINTS.MOVIES_SINGLE}?page=${page}&limit=${limit}`);
      return response;
    } catch (error) {
      console.warn('Error fetching single movies:', error);
      throw error;
    }
  },

  /**
   * Search movies by keyword
   */
  searchMovies: async (keyword, page = 1, limit = 24) => {
    try {
      const params = new URLSearchParams({ keyword, page: page.toString(), limit: limit.toString() });
      const response = await apiClient.get(`${ENDPOINTS.SEARCH}?${params.toString()}`);
      return response;
    } catch (error) {
      console.warn('Error searching movies:', error);
      throw error;
    }
  },
};

export default movieService;
