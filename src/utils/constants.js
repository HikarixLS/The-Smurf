// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ophim1.com';
export const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 10000;

// App Configuration
export const APP_NAME = 'The Smurf';
export const APP_DESCRIPTION = 'Watch movies and TV shows online';

// Pagination
export const ITEMS_PER_PAGE = 24;
export const SEARCH_LIMIT = 20;
export const AUTOCOMPLETE_LIMIT = 5;

// Image Configuration
export const IMAGE_BASE_URL = 'https://img.ophim.live/uploads/movies/';
export const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x450?text=No+Image';

// LocalStorage Keys
export const STORAGE_KEYS = {
  AUTH: 'smurf_auth',
  WATCHLIST: 'smurf_watchlist',
  HISTORY: 'smurf_history',
  NOTIFICATIONS: 'smurf_notifications',
  THEME: 'smurf_theme',
};

// Routes
export const ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  BROWSE: '/browse',
  MOVIE_DETAIL: '/movie/:slug',
  WATCH: '/watch/:slug',
  WATCH_PARTY: '/watch/:slug/party/:roomId',
  PROFILE: '/profile',
  WATCHLIST: '/profile/watchlist',
  HISTORY: '/profile/history',
  LOGIN: '/login',
  REGISTER: '/register',
  NOT_FOUND: '*',
};

// Movie Types
export const MOVIE_TYPES = {
  SINGLE: 'single',
  SERIES: 'series',
  ALL: 'all',
};

// Quality Options
export const QUALITY_OPTIONS = ['HD', 'FullHD', '4K', 'CAM', 'SD'];

// Language Options
export const LANGUAGE_OPTIONS = ['Vietsub', 'Thuyết minh', 'Lồng tiếng'];

// Notification Types
export const NOTIFICATION_TYPES = {
  NEW_RELEASE: 'new_release',
  WATCHLIST_AVAILABLE: 'watchlist_available',
  WATCH_PARTY_INVITE: 'watch_party_invite',
  SYSTEM: 'system',
};

// Breakpoints (pixels)
export const BREAKPOINTS = {
  MOBILE: 640,
  TABLET: 1024,
  DESKTOP: 1440,
};

// Debounce Delays (ms)
export const DEBOUNCE_DELAYS = {
  SEARCH: 500,
  SCROLL: 200,
  RESIZE: 300,
};

// Firebase Configuration Keys
export const FIREBASE_CONFIG_KEYS = {
  API_KEY: 'VITE_FIREBASE_API_KEY',
  AUTH_DOMAIN: 'VITE_FIREBASE_AUTH_DOMAIN',
  DATABASE_URL: 'VITE_FIREBASE_DATABASE_URL',
  PROJECT_ID: 'VITE_FIREBASE_PROJECT_ID',
  STORAGE_BUCKET: 'VITE_FIREBASE_STORAGE_BUCKET',
  MESSAGING_SENDER_ID: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  APP_ID: 'VITE_FIREBASE_APP_ID',
};
