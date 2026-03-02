import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiHeart, FiClock, FiLogOut, FiBookmark } from 'react-icons/fi';
import { ref, onValue } from 'firebase/database';
import { database } from '@/services/firebase/config';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import { useAuth } from '@/services/firebase/AuthContext';
import { getImageUrl, PLACEHOLDER_IMG } from '@/utils/helpers';
import styles from './Profile.module.css';

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);

  // Real-time listeners instead of one-shot get() — instantly reflects adds/removes
  useEffect(() => {
    if (!user || !database) return;

    const parse = (snapshot) => {
      if (!snapshot.exists()) return [];
      const items = [];
      snapshot.forEach(child => items.push(child.val()));
      return items;
    };

    const favRef = ref(database, `userFavorites/${user.uid}`);
    const wlRef = ref(database, `userWatchlists/${user.uid}`);
    const histRef = ref(database, `userHistory/${user.uid}`);

    const unsubFav = onValue(favRef, snap => {
      setFavorites(parse(snap).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)));
    });
    const unsubWl = onValue(wlRef, snap => {
      setWatchlist(parse(snap).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)));
    });
    const unsubHist = onValue(histRef, snap => {
      setHistory(parse(snap).sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0)));
    });

    return () => {
      unsubFav();
      unsubWl();
      unsubHist();
    };
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
    if (!items || items.length === 0) return null;
    return (
      <div className={styles.movieList}>
        {items.map((item, index) => (
          <div
            key={item.slug || index}
            className={styles.movieItem}
            onClick={() => item.slug && navigate(`/movie/${item.slug}`)}
          >
            <img
              src={getImageUrl(item.thumb_url)}
              alt={item.origin_name || item.name || ''}
              className={styles.movieThumb}
              onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
            />
            <div className={styles.movieItemInfo}>
              <span className={styles.movieItemTitle}>{item.origin_name || item.name || 'Unknown'}</span>
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
            <div className={styles.userCard}>
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
            </div>

            <div className={styles.statsGrid}>
              {stats.map((stat, index) => (
                <div key={index} className={styles.statCard}>
                  <div className={styles.statIcon}>{stat.icon}</div>
                  <div className={styles.statValue}>{stat.value}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>❤️ Yêu thích</h2>
            {favorites.length > 0 ? renderMovieList(favorites) : (
              <p className={styles.emptyState}>Chưa có phim yêu thích. Nhấn ❤️ trên trang chi tiết phim!</p>
            )}
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🔖 Watchlist</h2>
            {watchlist.length > 0 ? renderMovieList(watchlist) : (
              <p className={styles.emptyState}>Chưa có phim trong watchlist. Nhấn 🔖 trên trang chi tiết phim!</p>
            )}
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🕐 Lịch sử xem</h2>
            {history.length > 0 ? renderMovieList(history) : (
              <p className={styles.emptyState}>Chưa xem phim nào. Khám phá ngay!</p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Profile;
