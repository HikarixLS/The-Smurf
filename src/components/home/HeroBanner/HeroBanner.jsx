import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlay, FiInfo, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { getImageUrl } from '@/utils/helpers';
import styles from './HeroBanner.module.css';

const HeroBanner = ({ movies = [] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const navigate = useNavigate();

    const featuredMovies = movies.slice(0, 8);

    const goToSlide = useCallback((index) => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentIndex(index);
        setTimeout(() => setIsTransitioning(false), 600);
    }, [isTransitioning]);

    const nextSlide = useCallback(() => {
        goToSlide((currentIndex + 1) % featuredMovies.length);
    }, [currentIndex, featuredMovies.length, goToSlide]);

    const prevSlide = useCallback(() => {
        goToSlide((currentIndex - 1 + featuredMovies.length) % featuredMovies.length);
    }, [currentIndex, featuredMovies.length, goToSlide]);

    // Auto-slide
    useEffect(() => {
        if (featuredMovies.length <= 1) return;
        const timer = setInterval(nextSlide, 6000);
        return () => clearInterval(timer);
    }, [nextSlide, featuredMovies.length]);

    if (featuredMovies.length === 0) return null;

    const current = featuredMovies[currentIndex];
    const posterUrl = getImageUrl(current.poster_url || current.thumb_url);
    const rating = current.tmdb?.vote_average || 0;

    return (
        <section className={styles.heroBanner}>
            {/* Background */}
            <div className={styles.backdrop}>
                <img
                    src={posterUrl}
                    alt={current.name}
                    className={styles.backdropImage}
                    key={currentIndex}
                />
                <div className={styles.gradientOverlay} />
            </div>

            {/* Content */}
            <div className={styles.content}>
                <div className={styles.info}>
                    <h1 className={styles.title} key={`title-${currentIndex}`}>
                        {current.name}
                    </h1>

                    {current.origin_name && (
                        <p className={styles.originName}>{current.origin_name}</p>
                    )}

                    <div className={styles.meta}>
                        {rating > 0 && (
                            <span className={styles.rating}>
                                ⭐ {rating.toFixed(1)}
                            </span>
                        )}
                        {current.year && <span className={styles.badge}>{current.year}</span>}
                        {current.time && <span className={styles.badge}>{current.time}</span>}
                        {current.episode_current && (
                            <span className={styles.badge}>{current.episode_current}</span>
                        )}
                    </div>

                    {current.category && current.category.length > 0 && (
                        <div className={styles.categories}>
                            {current.category.slice(0, 3).map((cat, i) => (
                                <span key={i} className={styles.categoryTag}>{cat.name}</span>
                            ))}
                        </div>
                    )}

                    <div className={styles.actions}>
                        <button
                            className={styles.playBtn}
                            onClick={() => navigate(`/watch/${current.slug}`)}
                        >
                            <FiPlay /> Xem ngay
                        </button>
                        <button
                            className={styles.infoBtn}
                            onClick={() => navigate(`/movie/${current.slug}`)}
                        >
                            <FiInfo /> Chi tiết
                        </button>
                    </div>
                </div>

                {/* Thumbnail previews */}
                <div className={styles.thumbnails}>
                    {featuredMovies.map((movie, index) => (
                        <div
                            key={movie.slug || index}
                            className={`${styles.thumbnail} ${index === currentIndex ? styles.thumbnailActive : ''}`}
                            onClick={() => goToSlide(index)}
                        >
                            <img
                                src={getImageUrl(movie.thumb_url || movie.poster_url)}
                                alt={movie.name}
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation arrows */}
            <button className={styles.navPrev} onClick={prevSlide}>
                <FiChevronLeft />
            </button>
            <button className={styles.navNext} onClick={nextSlide}>
                <FiChevronRight />
            </button>

            {/* Dots indicator */}
            <div className={styles.dots}>
                {featuredMovies.map((_, index) => (
                    <button
                        key={index}
                        className={`${styles.dot} ${index === currentIndex ? styles.dotActive : ''}`}
                        onClick={() => goToSlide(index)}
                    />
                ))}
            </div>
        </section>
    );
};

export default HeroBanner;
