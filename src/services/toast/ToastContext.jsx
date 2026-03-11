import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '@/components/common/Toast/Toast';

const ToastContext = createContext(null);

let _showToast = null; // module-level reference for imperative usage

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const counterRef = useRef(0);

    const showToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++counterRef.current;
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Expose globally for imperative usage (outside React tree)
    _showToast = showToast;

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <Toast toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

/**
 * React hook – use inside components
 * @returns {{ showToast: (message: string, type?: 'success'|'error'|'warning'|'info', duration?: number) => void }}
 */
export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
};

/**
 * Imperative helper – use outside React components (e.g. services, utils)
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [duration=4000]
 */
export const showToast = (message, type = 'info', duration = 4000) => {
    if (_showToast) {
        _showToast(message, type, duration);
    } else {
        console.warn('[Toast] ToastProvider not mounted yet');
    }
};

// Also expose on window for quick testing in DevTools
if (typeof window !== 'undefined') {
    window.__showToast = showToast;
}

export default ToastContext;
