import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiStar, FiPlay } from 'react-icons/fi';
import PropTypes from 'prop-types';
import { getImageUrl } from '@/utils/helpers';
import styles from './MovieCard.module.css';

const MovieCard = ({ movie }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/movie/${movie.slug}`);
  };

  const posterUrl = getImageUrl(movie.poster_url || movie.thumb_url);
  const rating = movie.tmdb?.vote_average || movie.imdb?.rating || 0;
  const displayTitle = movie.origin_name || movie.name;
  const subTitle = movie.origin_name && movie.name !== movie.origin_name ? movie.name : '';

  return (
    <div className={styles.movieCard} onClick={handleClick}>
      <div className={styles.posterContainer}>
        <img
          src={posterUrl}
          alt={displayTitle}
          className={styles.poster}
          loading="lazy"
          width={300}
          height={450}
        />

        <div className={styles.badges}>
          <div>
            {movie.quality && (
              <span className={`${styles.badge} ${styles.quality}`}>
                {movie.quality}
              </span>
            )}
            {movie.lang && (
              <span className={`${styles.badge} ${styles.lang}`}>
                {movie.lang}
              </span>
            )}
          </div>
          {movie.episode_current && (
            <span className={`${styles.badge} ${styles.episode}`}>
              {movie.episode_current}
            </span>
          )}
        </div>

        <div className={styles.playOverlay}>
          <div className={styles.playIcon}>
            <FiPlay />
          </div>
        </div>

        <div className={styles.overlay} />
      </div>

      <div className={styles.info}>
        <h3 className={styles.title}>{displayTitle}</h3>
        {subTitle && <p className={styles.subTitle}>{subTitle}</p>}

        <div className={styles.meta}>
          {movie.year && <span className={styles.year}>{movie.year}</span>}
          {rating > 0 && (
            <div className={styles.rating}>
              <FiStar size={12} />
              {rating.toFixed(1)}
            </div>
          )}
        </div>

        {movie.category && movie.category.length > 0 && (
          <div className={styles.categories}>
            {movie.category.slice(0, 3).map((cat, index) => (
              <span key={index} className={styles.category}>
                {cat.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

MovieCard.propTypes = {
  movie: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    poster_url: PropTypes.string,
    thumb_url: PropTypes.string,
    quality: PropTypes.string,
    lang: PropTypes.string,
    episode_current: PropTypes.string,
    year: PropTypes.number,
    category: PropTypes.arrayOf(
      PropTypes.shape({ name: PropTypes.string })
    ),
    tmdb: PropTypes.shape({ vote_average: PropTypes.number }),
    imdb: PropTypes.shape({ rating: PropTypes.number }),
  }).isRequired,
};

export default MovieCard;
