import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX } from 'react-icons/fi';
import PropTypes from 'prop-types';
import { searchService } from '@/services/api/searchService';
import useDebounce from '@/hooks/useDebounce';
import { getImageUrl, getWebpImageUrl, handleOptimizedImageError, PLACEHOLDER_IMG } from '@/utils/helpers';
import styles from './SearchBar.module.css';

const SearchBar = ({ onSearch, autoFocus = false }) => {
  const [keyword, setKeyword] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const debouncedKeyword = useDebounce(keyword, 400);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (debouncedKeyword && debouncedKeyword.length >= 2) {
      fetchSuggestions(debouncedKeyword);
    } else {
      setSuggestions([]);
      setShowAutocomplete(false);
    }
  }, [debouncedKeyword]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchTerm) => {
    setLoading(true);
    try {
      const response = await searchService.getSearchSuggestions(searchTerm, 8);
      if (response && response.data && response.data.items) {
        setSuggestions(response.data.items);
        setShowAutocomplete(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setKeyword(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (keyword.trim()) {
      setShowAutocomplete(false);
      if (onSearch) {
        onSearch(keyword);
      } else {
        navigate(`/search?q=${encodeURIComponent(keyword)}`);
      }
    }
  };

  const handleSuggestionClick = (movie) => {
    setKeyword('');
    setShowAutocomplete(false);
    navigate(`/movie/${movie.slug}`);
  };

  const handleClear = () => {
    setKeyword('');
    setSuggestions([]);
    setShowAutocomplete(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={styles.searchBar} ref={wrapperRef}>
      <form onSubmit={handleSubmit}>
        <div className={styles.inputContainer}>
          <FiSearch className={styles.searchIcon} size={20} />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Tìm kiếm phim..."
            value={keyword}
            onChange={handleInputChange}
            onFocus={() => keyword.length >= 2 && suggestions.length > 0 && setShowAutocomplete(true)}
          />
          {keyword && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
            >
              <FiX size={16} />
            </button>
          )}
        </div>
      </form>

      {showAutocomplete && suggestions.length > 0 && (
        <div className={styles.autocomplete}>
          {suggestions.map((movie) => (
            <div
              key={movie._id || movie.slug}
              className={styles.autocompleteItem}
              onMouseDown={() => handleSuggestionClick(movie)}
            >
              <img
                src={getWebpImageUrl(movie.poster_url || movie.thumb_url)}
                data-original-src={getImageUrl(movie.poster_url || movie.thumb_url)}
                alt={movie.name}
                className={styles.itemThumb}
                onError={(e) => handleOptimizedImageError(e, { fallbackSrc: PLACEHOLDER_IMG })}
              />
              <div className={styles.itemContent}>
                <div className={styles.itemTitle}>{movie.name}</div>
                {movie.origin_name && movie.origin_name !== movie.name && (
                  <div className={styles.itemOrigin}>{movie.origin_name}</div>
                )}
                <div className={styles.itemMeta}>
                  {movie.year && <span>{movie.year}</span>}
                  {movie.quality && <span className={styles.itemBadge}>{movie.quality}</span>}
                  {movie.lang && <span className={styles.itemBadge}>{movie.lang}</span>}
                  {movie.episode_current && <span>{movie.episode_current}</span>}
                </div>
              </div>
            </div>
          ))}
          {keyword.trim() && (
            <div
              className={styles.viewAll}
              onMouseDown={() => {
                setShowAutocomplete(false);
                navigate(`/search?q=${encodeURIComponent(keyword)}`);
              }}
            >
              Xem tất cả kết quả cho "{keyword}"
            </div>
          )}
        </div>
      )}

      {showAutocomplete && keyword.length >= 2 && suggestions.length === 0 && !loading && (
        <div className={styles.autocomplete}>
          <div className={styles.noResults}>Không tìm thấy kết quả</div>
        </div>
      )}

      {showAutocomplete && loading && keyword.length >= 2 && suggestions.length === 0 && (
        <div className={styles.autocomplete}>
          <div className={styles.noResults}>Đang tìm kiếm...</div>
        </div>
      )}
    </div>
  );
};

SearchBar.propTypes = {
  onSearch: PropTypes.func,
  autoFocus: PropTypes.bool,
};

export default SearchBar;
