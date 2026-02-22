import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FiMonitor } from 'react-icons/fi';
import { useAuth } from '@/services/firebase/AuthContext';
import styles from './Login.module.css';

const Login = () => {
    const { user, loading, signIn } = useAuth();
    const [signingIn, setSigningIn] = useState(false);
    const [error, setError] = useState('');

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <div className={styles.loader} />
            </div>
        );
    }

    if (user) {
        return <Navigate to="/" replace />;
    }

    const handleGoogleSignIn = async () => {
        setSigningIn(true);
        setError('');
        try {
            await signIn();
        } catch (err) {
            setError('Đăng nhập thất bại. Vui lòng thử lại.');
            console.error(err);
        } finally {
            setSigningIn(false);
        }
    };

    return (
        <div className={styles.loginPage}>
            <div className={styles.backdrop} />
            <div className={styles.loginCard}>
                <div className={styles.logo}>
                    <FiMonitor size={40} />
                    <h1>The Smurf</h1>
                </div>
                <p className={styles.tagline}>Xem phim online chất lượng cao</p>

                <div className={styles.divider} />

                <h2 className={styles.welcome}>Chào mừng bạn</h2>
                <p className={styles.subtitle}>Đăng nhập để bắt đầu xem phim</p>

                {error && <p className={styles.error}>{error}</p>}

                <button
                    className={styles.googleBtn}
                    onClick={handleGoogleSignIn}
                    disabled={signingIn}
                >
                    <FcGoogle size={22} />
                    {signingIn ? 'Đang đăng nhập...' : 'Đăng nhập bằng Google'}
                </button>

                <p className={styles.terms}>
                    Bằng việc đăng nhập, bạn đồng ý với điều khoản sử dụng của chúng tôi
                </p>
            </div>
        </div>
    );
};

export default Login;
