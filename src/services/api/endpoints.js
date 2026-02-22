// API Endpoints
export const ENDPOINTS = {
  // Movie listings
  MOVIES_NEW: '/v1/api/danh-sach/phim-moi-cap-nhat',
  MOVIES_FEATURE: '/v1/api/danh-sach/phim-bo',
  MOVIES_SERIES: '/v1/api/danh-sach/phim-bo',
  MOVIES_SINGLE: '/v1/api/danh-sach/phim-le',
  MOVIES_UPCOMING: '/v1/api/danh-sach/phim-sap-chieu',
  MOVIES_TRENDING: '/v1/api/danh-sach/phim-moi-cap-nhat', // Same as new, sorted by views

  // Search
  SEARCH: '/v1/api/tim-kiem',

  // Movie details
  MOVIE_DETAIL: '/v1/api/phim', // /v1/api/phim/{slug}

  // Filters
  CATEGORY: '/v1/api/the-loai', // /v1/api/the-loai/{slug}
  COUNTRY: '/v1/api/quoc-gia', // /v1/api/quoc-gia/{slug}
  YEAR: '/v1/api/nam-phat-hanh', // /v1/api/nam-phat-hanh/{year}
};

export default ENDPOINTS;
