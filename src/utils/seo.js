import { APP_NAME, APP_DESCRIPTION } from './constants';

// Update page meta tags
export const updatePageMeta = ({ title, description, image, url, keywords }) => {
  // Update title
  document.title = title ? `${title} | ${APP_NAME}` : `${APP_NAME} - ${APP_DESCRIPTION}`;

  // Helper function to update or create meta tag
  const updateMetaTag = (selector, attr, value) => {
    if (!value) return;

    let meta = document.querySelector(selector);
    if (!meta) {
      meta = document.createElement('meta');
      const [attrName, attrValue] = selector.match(/\[(.*?)="(.*?)"\]/).slice(1);
      meta.setAttribute(attrName, attrValue);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', value);
  };

  // Update meta tags
  updateMetaTag('meta[name="description"]', 'name', description || APP_DESCRIPTION);
  updateMetaTag('meta[name="keywords"]', 'name', keywords);

  // Open Graph
  updateMetaTag('meta[property="og:title"]', 'property', title || APP_NAME);
  updateMetaTag('meta[property="og:description"]', 'property', description || APP_DESCRIPTION);
  updateMetaTag('meta[property="og:image"]', 'property', image);
  updateMetaTag('meta[property="og:url"]', 'property', url || window.location.href);
  updateMetaTag('meta[property="og:type"]', 'property', 'website');

  // Twitter Card
  updateMetaTag('meta[name="twitter:card"]', 'name', 'summary_large_image');
  updateMetaTag('meta[name="twitter:title"]', 'name', title || APP_NAME);
  updateMetaTag('meta[name="twitter:description"]', 'name', description || APP_DESCRIPTION);
  updateMetaTag('meta[name="twitter:image"]', 'name', image);
};

// Generate movie meta tags
export const generateMovieMeta = (movie) => {
  if (!movie) return {};

  const title = `${movie.name} (${movie.year || 'N/A'})`;
  const description = movie.content
    ? movie.content.replace(/<[^>]*>/g, '').substring(0, 160)
    : `Xem phim ${movie.name} (${movie.origin_name || ''}) - ${movie.year || 'N/A'}. ${movie.quality || ''} ${movie.lang || ''}`;

  const image = movie.poster_url || movie.thumb_url;
  const keywords = [
    movie.name,
    movie.origin_name,
    ...(movie.category || []).map(cat => cat.name),
    ...(movie.country || []).map(c => c.name),
    movie.quality,
    movie.lang,
    'phim',
    'xem phim',
  ].filter(Boolean).join(', ');

  return {
    title,
    description,
    image,
    url: `${window.location.origin}/movie/${movie.slug}`,
    keywords,
  };
};

// Generate search meta tags
export const generateSearchMeta = (keyword, count) => {
  return {
    title: `Tìm kiếm: ${keyword}`,
    description: `Tìm thấy ${count || 0} kết quả cho "${keyword}". Xem phim online chất lượng cao tại ${APP_NAME}.`,
    keywords: `${keyword}, tìm kiếm phim, xem phim ${keyword}`,
  };
};

// Generate browse meta tags
export const generateBrowseMeta = (filters) => {
  const parts = [];

  if (filters.genre) parts.push(filters.genre);
  if (filters.country) parts.push(filters.country);
  if (filters.year) parts.push(filters.year);

  const title = parts.length > 0 ? `Phim ${parts.join(' - ')}` : 'Danh sách phim';
  const description = `Xem phim ${parts.join(', ')} chất lượng cao, vietsub, thuyết minh tại ${APP_NAME}.`;

  return {
    title,
    description,
    keywords: parts.join(', '),
  };
};

// Add structured data for movie
export const addMovieStructuredData = (movie) => {
  if (!movie) return;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.name,
    alternateName: movie.origin_name,
    image: movie.poster_url || movie.thumb_url,
    description: movie.content?.replace(/<[^>]*>/g, ''),
    datePublished: movie.year,
    aggregateRating: movie.tmdb?.vote_average ? {
      '@type': 'AggregateRating',
      ratingValue: movie.tmdb.vote_average,
      ratingCount: movie.tmdb.vote_count,
    } : undefined,
  };

  let script = document.querySelector('script[type="application/ld+json"]');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(structuredData);
};

// Remove structured data
export const removeStructuredData = () => {
  const script = document.querySelector('script[type="application/ld+json"]');
  if (script) {
    script.remove();
  }
};
