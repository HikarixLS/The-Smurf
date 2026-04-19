import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiHeart, FiClock, FiLogOut, FiBookmark, FiPlay } from 'react-icons/fi';
import { ref, onValue } from 'firebase/database';
import { database } from '@/services/firebase/config';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import { useAuth } from '@/services/firebase/AuthContext';
import { getImageUrl, getWebpImageUrl, handleOptimizedImageError, PLACEHOLDER_IMG } from '@/utils/helpers';
import styles from './Profile.module.css';

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);
  const [watchProgress, setWatchProgress] = useState({});
  const [loading, setLoading] = useState(true);

  // Track how many of the 3 listeners have fired at least once
  const loadedRef = useRef(0);
  const markLoaded = () => {
    loadedRef.current += 1;
    if (loadedRef.current >= 3) setLoading(false);
  };

  // Real-time listeners — instantly reflects adds/removes from any page
  useEffect(() => {
    if (!user || !database) {
      setLoading(false);
      return;
    }

    loadedRef.current = 0;
    setLoading(true);

    const parse = (snapshot) => {
      if (!snapshot.exists()) return [];
      const items = [];
      snapshot.forEach(child => {
        const val = child.val();
        if (val) items.push(val);
      });
      return items;
    };

    const favRef = ref(database, `userFavorites/${user.uid}`);
    const wlRef = ref(database, `userWatchlists/${user.uid}`);
    const histRef = ref(database, `userHistory/${user.uid}`);

    const unsubFav = onValue(favRef, snap => {
      setFavorites(parse(snap).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)));
      markLoaded();
    });
    const unsubWl = onValue(wlRef, snap => {
      setWatchlist(parse(snap).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)));
      markLoaded();
    });
    const unsubHist = onValue(histRef, snap => {
      setHistory(parse(snap).sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0)));
      markLoaded();
    });

    // Realtime watch progress
    const progressRef = ref(database, `userWatchProgress/${user.uid}`);
    const unsubProgress = onValue(progressRef, snap => {
      if (snap.exists()) {
        const prog = {};
        snap.forEach(child => { prog[child.key] = child.val(); });
        setWatchProgress(prog);
      } else {
        setWatchProgress({});
      }
    });

    return () => {
      unsubFav();
      unsubWl();
      unsubHist();
      unsubProgress();
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
    { icon: <FiHeart />, label: 'Yêu thích', value: loading ? '—' : favorites.length.toString() },
    { icon: <FiBookmark />, label: 'Watchlist', value: loading ? '—' : watchlist.length.toString() },
    { icon: <FiClock />, label: 'Lịch sử xem', value: loading ? '—' : history.length.toString() },
  ];

  const renderMovieList = (items, isHistory = false) => {
    if (!items || items.length === 0) return null;
    return (
      <div className={styles.movieList}>
        {items.map((item, index) => {
          const progress = isHistory ? watchProgress[item.slug] : null;
          const pct = progress ? Math.round(progress.percent * 100) : 0;
          return (
            <div
              key={item.slug || index}
              className={styles.movieItem}
              onClick={() => {
                if (!item.slug) return;
                navigate(isHistory ? `/watch/${item.slug}` : `/movie/${item.slug}`);
              }}
            >
              <img
                src={getWebpImageUrl(item.thumb_url)}
                data-original-src={getImageUrl(item.thumb_url)}
                alt={item.origin_name || item.name || ''}
                className={styles.movieThumb}
                onError={e => handleOptimizedImageError(e, { fallbackSrc: PLACEHOLDER_IMG })}
              />
              <div className={styles.movieItemInfo}>
                <span className={styles.movieItemTitle}>{item.origin_name || item.name || 'Unknown'}</span>
                {item.year && <span className={styles.movieItemYear}>{item.year}</span>}
                {isHistory && progress && (
                  <div className={styles.progressBarWrapper}>
                    <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
                    <span className={styles.progressLabel}>{pct}%</span>
                  </div>
                )}
              </div>
              {isHistory && (
                <div className={styles.playIcon}>
                  <FiPlay size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const sectionCount = (count) => !loading
    ? <span className={styles.sectionCount}>• {count} phim</span>
    : null;

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
            <h2 className={styles.sectionTitle}>❤️ Yêu thích {sectionCount(favorites.length)}</h2>
            {loading ? (
              <p className={styles.emptyState}>Đang tải...</p>
            ) : favorites.length > 0 ? renderMovieList(favorites) : (
              <p className={styles.emptyState}>Chưa có phim yêu thích. Nhấn ❤️ trên trang chi tiết phim!</p>
            )}
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🔖 Watchlist {sectionCount(watchlist.length)}</h2>
            {loading ? (
              <p className={styles.emptyState}>Đang tải...</p>
            ) : watchlist.length > 0 ? renderMovieList(watchlist) : (
              <p className={styles.emptyState}>Chưa có phim trong watchlist. Nhấn 🔖 trên trang chi tiết phim!</p>
            )}
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🕐 Lịch sử xem {sectionCount(history.length)}</h2>
            {loading ? (
              <p className={styles.emptyState}>Đang tải...</p>
            ) : history.length > 0 ? renderMovieList(history, true) : (
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
