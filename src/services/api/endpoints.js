// API Endpoints
export const ENDPOINTS = {
  // Movie listings
  MOVIES_NEW: '/danh-sach/phim-moi-cap-nhat',
  MOVIES_FEATURE: '/danh-sach/phim-bo',
  MOVIES_SERIES: '/danh-sach/phim-bo',
  MOVIES_SINGLE: '/danh-sach/phim-le',
  MOVIES_UPCOMING: '/danh-sach/phim-sap-chieu',
  MOVIES_TRENDING: '/danh-sach/phim-moi-cap-nhat', // Same as new, sorted by views

  // Search
  SEARCH: '/v1/api/tim-kiem',

  // Movie details
  MOVIE_DETAIL: '/phim', // /phim/{slug}

  // Filters
  CATEGORY: '/the-loai', // /the-loai/{slug}
  COUNTRY: '/quoc-gia', // /quoc-gia/{slug}
  YEAR: '/nam-phat-hanh', // /nam-phat-hanh/{year}
};

export default ENDPOINTS;
