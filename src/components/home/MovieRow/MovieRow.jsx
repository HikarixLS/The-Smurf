import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiArrowRight } from 'react-icons/fi';
import MovieCard from '@/components/movie/MovieCard/MovieCard';
import styles from './MovieRow.module.css';

const MovieRow = ({ title, movies = [], linkTo, loading = false }) => {
    const scrollRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);
    const navigate = useNavigate();

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setShowLeftArrow(el.scrollLeft > 10);
        setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    const scroll = (direction) => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollAmount = el.clientWidth * 0.8;
        el.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    };

    if (!loading && movies.length === 0) return null;

    return (
        <section className={styles.movieRow}>
            <div className={styles.header}>
                <h2 className={styles.title}>{title}</h2>
                {linkTo && (
                    <button
                        className={styles.viewAll}
                        onClick={() => navigate(linkTo)}
                    >
                        Xem tất cả <FiArrowRight />
                    </button>
                )}
            </div>

            <div className={styles.sliderWrapper}>
                {showLeftArrow && (
                    <button
                        className={`${styles.scrollBtn} ${styles.scrollLeft}`}
                        onClick={() => scroll('left')}
                    >
                        <FiChevronLeft />
                    </button>
                )}

                <div
                    className={styles.slider}
                    ref={scrollRef}
                    onScroll={handleScroll}
                >
                    {loading
                        ? Array(6).fill(0).map((_, i) => (
                            <div key={i} className={styles.skeleton} />
                        ))
                        : movies.map((movie) => (
                            <div key={movie._id || movie.slug} className={styles.cardWrapper}>
                                <MovieCard movie={movie} />
                            </div>
                        ))
                    }
                </div>

                {showRightArrow && movies.length > 4 && (
                    <button
                        className={`${styles.scrollBtn} ${styles.scrollRight}`}
                        onClick={() => scroll('right')}
                    >
                        <FiChevronRight />
                    </button>
                )}
            </div>
        </section>
    );
};

export default MovieRow;
