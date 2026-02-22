import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { getAnalytics, logEvent, setUserId, setUserProperties } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check if Firebase is configured
const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey &&
        firebaseConfig.apiKey !== 'your_api_key_here' &&
        firebaseConfig.databaseURL &&
        firebaseConfig.databaseURL !== 'https://your_project_id.firebaseio.com';
};

let app = null;
let database = null;
let auth = null;
let analytics = null;

if (isFirebaseConfigured()) {
    try {
        app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        auth = getAuth(app);
        // Initialize Google Analytics (GA4)
        if (typeof window !== 'undefined') {
            analytics = getAnalytics(app);
        }
    } catch (error) {
        console.warn('Firebase initialization error:', error);
    }
}

// ---- Analytics helpers ----

// Log a page view
export const logPageView = (pagePath, pageTitle) => {
    if (!analytics) return;
    logEvent(analytics, 'page_view', {
        page_path: pagePath,
        page_title: pageTitle,
    });
};

// Log a custom event
export const logCustomEvent = (eventName, params = {}) => {
    if (!analytics) return;
    logEvent(analytics, eventName, params);
};

// Set user ID for analytics (call after sign-in)
export const setAnalyticsUser = (user) => {
    if (!analytics || !user) return;
    setUserId(analytics, user.uid);
    setUserProperties(analytics, {
        display_name: user.displayName || '',
        email_domain: user.email ? user.email.split('@')[1] : '',
    });
};

// Google sign-in
const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    if (!auth) return null;
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
};

// Sign out
export const signOut = async () => {
    if (!auth) return;
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error('Sign out error:', error);
        throw error;
    }
};

// Get current user
export const getCurrentUser = () => {
    return new Promise((resolve) => {
        if (!auth) {
            resolve(null);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        });
    });
};

export { app, database, auth, analytics, isFirebaseConfigured };
export default app;

