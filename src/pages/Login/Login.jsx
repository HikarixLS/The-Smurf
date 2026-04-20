import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FiMonitor } from 'react-icons/fi';
import { useAuth } from '@/services/firebase/AuthContext';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { isAndroidTv } from '@/utils/device';
import styles from './Login.module.css';

const Login = () => {
    const { user, loading, signIn } = useAuth();
    const firebaseEnabled = isFirebaseConfigured();
    const androidTvMode = isAndroidTv();
    const [signingIn, setSigningIn] = useState(false);
    const [error, setError] = useState('');

    const isCredentialServiceUnsupported = (err) => {
        const details = [err?.message, err?.code, err?.errorMessage, err]
            .map((value) => String(value || '').toLowerCase())
            .join(' ');
        return details.includes('credential') && (
            details.includes("doesn't support") ||
            details.includes('does not support') ||
            details.includes('not support') ||
            details.includes('unsupported') ||
            details.includes('service')
        );
    };

    if (!firebaseEnabled) {
        return <Navigate to="/" replace />;
    }

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
            console.error('Sign-in error:', err);
            const msg = err?.message === 'FIREBASE_NOT_CONFIGURED'
                ? 'Firebase chưa được cấu hình trong môi trường hiện tại.'
                : isCredentialServiceUnsupported(err)
                    ? 'Thiết bị không hỗ trợ Credential Service. Vui lòng thử đăng nhập lại, ứng dụng sẽ tự chuyển sang chế độ tương thích Android TV.'
                : (err?.message || err?.code || JSON.stringify(err));
            setError(`Lỗi: ${msg}`);
        } finally {
            setSigningIn(false);
        }
    };

    return (
        <div className={`${styles.loginPage} ${androidTvMode ? styles.loginPageTv : ''}`}>
            <div className={`${styles.backdrop} ${androidTvMode ? styles.backdropTv : ''}`} />
            <div className={`${styles.loginCard} ${androidTvMode ? styles.loginCardTv : ''}`}>
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
                    type="button"
                    className={styles.googleBtn}
                    onClick={handleGoogleSignIn}
                    disabled={signingIn}
                    autoFocus
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
