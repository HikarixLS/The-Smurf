import React, { useEffect, useRef } from 'react';
import { FiX, FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';
import styles from './Toast.module.css';

const ICONS = {
    success: <FiCheckCircle size={18} />,
    error: <FiAlertCircle size={18} />,
    warning: <FiAlertTriangle size={18} />,
    info: <FiInfo size={18} />,
};

const ToastItem = ({ toast, onRemove }) => {
    const timerRef = useRef(null);

    useEffect(() => {
        timerRef.current = setTimeout(() => onRemove(toast.id), toast.duration ?? 4000);
        return () => clearTimeout(timerRef.current);
    }, [toast.id, toast.duration, onRemove]);

    return (
        <div className={`${styles.toast} ${styles[toast.type ?? 'info']}`} role="alert">
            <span className={styles.icon}>{ICONS[toast.type ?? 'info']}</span>
            <span className={styles.message}>{toast.message}</span>
            <button className={styles.closeBtn} onClick={() => onRemove(toast.id)} aria-label="Đóng">
                <FiX size={14} />
            </button>
            <div
                className={styles.progressBar}
                style={{ animationDuration: `${toast.duration ?? 4000}ms` }}
            />
        </div>
    );
};

const Toast = ({ toasts, onRemove }) => {
    if (!toasts || toasts.length === 0) return null;

    return (
        <div className={styles.container} aria-live="polite">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
};

export default Toast;
