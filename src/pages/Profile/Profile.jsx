import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiHeart, FiClock, FiLogOut } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import GlassCard from '@/components/common/GlassCard/GlassCard';
import { useAuth } from '@/services/firebase/AuthContext';
import styles from './Profile.module.css';

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const stats = [
    { icon: <FiHeart />, label: 'Watchlist', value: '0' },
    { icon: <FiClock />, label: 'Đã xem', value: '0' },
  ];

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
            <h2 className={styles.sectionTitle}>Watchlist</h2>
            <p className={styles.emptyState}>
              Chưa có phim trong watchlist. Bắt đầu thêm phim yêu thích của bạn!
            </p>
          </GlassCard>

          <GlassCard className={styles.section}>
            <h2 className={styles.sectionTitle}>Lịch sử xem</h2>
            <p className={styles.emptyState}>
              Chưa xem phim nào. Khám phá ngay!
            </p>
          </GlassCard>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Profile;

