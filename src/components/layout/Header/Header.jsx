import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiMenu } from 'react-icons/fi';
import styles from './Header.module.css';

const Header = () => {
  const navigate = useNavigate();

  const navItems = [
    { label: 'Trang chủ', path: '/' },
    { label: 'Phim lẻ', path: '/browse?type=single' },
    { label: 'Phim bộ', path: '/browse?type=series' },
    { label: 'Thể loại', path: '/browse' },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link to="/" className={styles.logo}>
          THE SMURF
        </Link>

        <nav className={styles.nav}>
          <ul className={styles.navLinks}>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link to={item.path} className={styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <FiSearch
            className={styles.searchIcon}
            onClick={() => navigate('/search')}
          />
          <FiUser
            className={styles.userIcon}
            onClick={() => navigate('/profile')}
          />
          <FiMenu className={styles.mobileMenuButton} />
        </div>
      </div>
    </header>
  );
};

export default Header;
