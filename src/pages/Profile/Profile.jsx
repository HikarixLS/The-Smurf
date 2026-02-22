import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiHeart, FiClock, FiLogOut, FiBookmark } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import GlassCard from '@/components/common/GlassCard/GlassCard';
import { useAuth } from '@/services/firebase/AuthContext';
import { getFavorites, getWatchlist, getHistory } from '@/services/firebase/watchlistService';
import { getImageUrl } from '@/utils/helpers';
import styles from './Profile.module.css';

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [fav, wl, hist] = await Promise.all([
        getFavorites(user.uid),
        getWatchlist(user.uid),
        getHistory(user.uid),
      ]);
      setFavorites(fav);
      setWatchlist(wl);
      setHistory(hist);
    };
    load();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const stats = [
    { icon: <FiHeart />, label: 'Yêu thích', value: favorites.length.toString() },
    { icon: <FiBookmark />, label: 'Watchlist', value: watchlist.length.toString() },
    { icon: <FiClock />, label: 'Đã xem', value: history.length.toString() },
  ];

  const renderMovieList = (items) => {
    if (!items.length) return null;
    return (
      <div className={styles.movieList}>
        {items.map(item => (
          <div key={item.slug} className={styles.movieItem} onClick={() => navigate(`/movie/${item.slug}`)}>
            <img
              src={getImageUrl(item.thumb_url)}
              alt={item.origin_name || item.name}
              className={styles.movieThumb}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className={styles.movieItemInfo}>
              <span className={styles.movieItemTitle}>{item.origin_name || item.name}</span>
              {item.year && <span className={styles.movieItemYear}>{item.year}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Header />
      <main className={styles.profile}>
        <div className="container">
          <h1 className={styles.title}>Profile</h1>

          <div className={styles.grid}>
            <GlassCard className={styles.userCard}>
              <div className={styles.avatar}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className={styles.avatarImg} referrerPolicy="no-referrer" />
                ) : (
                  <FiUser size={64} />
                )}
              </div>
              <h2 className={styles.name}>{user?.displayName || 'User'}</h2>
              <p className={styles.email}>{user?.email || ''}</p>
              <button className={styles.signOutBtn} onClick={handleSignOut}>
                <FiLogOut size={16} /> Đăng xuất
              </button>
            </GlassCard>

            <div className={styles.statsGrid}>
              {stats.map((stat, index) => (
                <GlassCard key={index} className={styles.statCard}>
                  <div className={styles.statIcon}>{stat.icon}</div>
                  <div className={styles.statValue}>{stat.value}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </GlassCard>
              ))}
            </div>
          </div>

          <GlassCard className={styles.section}>
            <h2 className={styles.sectionTitle}>❤️ Yêu thích</h2>
            {favorites.length > 0 ? renderMovieList(favorites) : (
              <p className={styles.emptyState}>Chưa có phim yêu thích. Nhấn ❤️ trên trang chi tiết phim!</p>
            )}
          </GlassCard>

          <GlassCard className={styles.section}>
            <h2 className={styles.sectionTitle}>🔖 Watchlist</h2>
            {watchlist.length > 0 ? renderMovieList(watchlist) : (
              <p className={styles.emptyState}>Chưa có phim trong watchlist. Nhấn 🔖 trên trang chi tiết phim!</p>
            )}
          </GlassCard>

          <GlassCard className={styles.section}>
            <h2 className={styles.sectionTitle}>🕐 Lịch sử xem</h2>
            {history.length > 0 ? renderMovieList(history) : (
              <p className={styles.emptyState}>Chưa xem phim nào. Khám phá ngay!</p>
            )}
          </GlassCard>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Profile;


