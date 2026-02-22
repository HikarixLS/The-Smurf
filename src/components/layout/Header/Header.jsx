import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiMenu, FiX, FiChevronDown, FiMonitor } from 'react-icons/fi';
import styles from './Header.module.css';

const GENRES = [
  { name: 'Hành Động', slug: 'hanh-dong' },
  { name: 'Tình Cảm', slug: 'tinh-cam' },
  { name: 'Hài Hước', slug: 'hai-huoc' },
  { name: 'Kinh Dị', slug: 'kinh-di' },
  { name: 'Viễn Tưởng', slug: 'vien-tuong' },
  { name: 'Phiêu Lưu', slug: 'phieu-luu' },
  { name: 'Hình Sự', slug: 'hinh-su' },
  { name: 'Bí Ẩn', slug: 'bi-an' },
  { name: 'Hoạt Hình', slug: 'hoat-hinh' },
  { name: 'Gia Đình', slug: 'gia-dinh' },
  { name: 'Khoa Học', slug: 'khoa-hoc' },
  { name: 'Chính Kịch', slug: 'chinh-kich' },
  { name: 'Chiến Tranh', slug: 'chien-tranh' },
  { name: 'Âm Nhạc', slug: 'am-nhac' },
  { name: 'Thể Thao', slug: 'the-thao' },
  { name: 'Tâm Lý', slug: 'tam-ly' },
  { name: 'Bách Hợp', slug: 'bach-hop' },
  { name: 'Đam Mỹ', slug: 'dam-my' },
];

const COUNTRIES = [
  { name: 'Hàn Quốc', slug: 'han-quoc' },
  { name: 'Trung Quốc', slug: 'trung-quoc' },
  { name: 'Nhật Bản', slug: 'nhat-ban' },
  { name: 'Thái Lan', slug: 'thai-lan' },
  { name: 'Âu Mỹ', slug: 'au-my' },
  { name: 'Đài Loan', slug: 'dai-loan' },
  { name: 'Hồng Kông', slug: 'hong-kong' },
  { name: 'Ấn Độ', slug: 'an-do' },
  { name: 'Anh', slug: 'anh' },
  { name: 'Pháp', slug: 'phap' },
  { name: 'Việt Nam', slug: 'viet-nam' },
  { name: 'Philippines', slug: 'philippines' },
];

const Header = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  const toggleDropdown = (name) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      <div className={styles.headerContent}>
        {/* Logo */}
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon}>🎬</span>
          <span className={styles.logoText}>THE SMURF</span>
        </Link>

        {/* Desktop Nav */}
        <nav className={styles.nav} ref={dropdownRef}>
          <Link to="/" className={styles.navLink}>Trang chủ</Link>

          {/* Thể loại dropdown */}
          <div className={styles.dropdownWrapper}>
            <button
              className={styles.navLink}
              onClick={() => toggleDropdown('genre')}
            >
              Thể loại <FiChevronDown className={`${styles.chevron} ${activeDropdown === 'genre' ? styles.chevronOpen : ''}`} />
            </button>
            {activeDropdown === 'genre' && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownGrid}>
                  {GENRES.map((genre) => (
                    <Link
                      key={genre.slug}
                      to={`/browse?genre=${genre.slug}`}
                      className={styles.dropdownItem}
                      onClick={() => setActiveDropdown(null)}
                    >
                      {genre.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quốc gia dropdown */}
          <div className={styles.dropdownWrapper}>
            <button
              className={styles.navLink}
              onClick={() => toggleDropdown('country')}
            >
              Quốc gia <FiChevronDown className={`${styles.chevron} ${activeDropdown === 'country' ? styles.chevronOpen : ''}`} />
            </button>
            {activeDropdown === 'country' && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownGrid}>
                  {COUNTRIES.map((country) => (
                    <Link
                      key={country.slug}
                      to={`/browse?country=${country.slug}`}
                      className={styles.dropdownItem}
                      onClick={() => setActiveDropdown(null)}
                    >
                      {country.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link to="/browse?type=series" className={styles.navLink}>Phim bộ</Link>
          <Link to="/browse?type=single" className={styles.navLink}>Phim lẻ</Link>
          <Link to="/watch-party" className={`${styles.navLink} ${styles.watchPartyLink}`}>
            <FiMonitor size={14} /> Xem chung
          </Link>
        </nav>

        {/* Search bar */}
        <form className={styles.searchBar} onSubmit={handleSearch}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Tìm phim, diễn viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </form>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.userBtn} onClick={() => navigate('/profile')}>
            <FiUser />
          </button>
          <button
            className={styles.mobileMenuBtn}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <form className={styles.mobileSearch} onSubmit={handleSearch}>
            <FiSearch />
            <input
              type="text"
              placeholder="Tìm phim..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
          <Link to="/" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Trang chủ</Link>
          <Link to="/browse?type=series" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Phim bộ</Link>
          <Link to="/browse?type=single" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Phim lẻ</Link>
          <Link to="/browse" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Thể loại</Link>
          <Link to="/watch-party" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>
            <FiMonitor /> Xem chung
          </Link>
        </div>
      )}
    </header>
  );
};

export default Header;
