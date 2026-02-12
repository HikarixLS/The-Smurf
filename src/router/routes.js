import { ROUTES } from './constants';

// Router configuration
export const routes = {
  HOME: ROUTES.HOME,
  SEARCH: ROUTES.SEARCH,
  BROWSE: ROUTES.BROWSE,
  MOVIE_DETAIL: ROUTES.MOVIE_DETAIL,
  WATCH: ROUTES.WATCH,
  WATCH_PARTY: ROUTES.WATCH_PARTY,
  PROFILE: ROUTES.PROFILE,
  WATCHLIST: ROUTES.WATCHLIST,
  HISTORY: ROUTES.HISTORY,
  LOGIN: ROUTES.LOGIN,
  REGISTER: ROUTES.REGISTER,
  NOT_FOUND: ROUTES.NOT_FOUND,
};

// Generate dynamic routes
export const generateMovieDetailRoute = (slug) => {
  return `/movie/${slug}`;
};

export const generateWatchRoute = (slug) => {
  return `/watch/${slug}`;
};

export const generateWatchPartyRoute = (slug, roomId) => {
  return `/watch/${slug}/party/${roomId}`;
};

export const generateSearchRoute = (keyword) => {
  return `/search?q=${encodeURIComponent(keyword)}`;
};

export const generateBrowseRoute = (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.genre) params.append('genre', filters.genre);
  if (filters.country) params.append('country', filters.country);
  if (filters.year) params.append('year', filters.year);
  if (filters.type) params.append('type', filters.type);
  if (filters.page) params.append('page', filters.page);

  const queryString = params.toString();
  return `/browse${queryString ? '?' + queryString : ''}`;
};

export default routes;
