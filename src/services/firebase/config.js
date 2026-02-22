import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
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

if (isFirebaseConfigured()) {
    try {
        app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        auth = getAuth(app);
    } catch (error) {
        console.warn('Firebase initialization error:', error);
    }
}

// Anonymous auth
export const signInAnon = async () => {
    if (!auth) return null;
    try {
        const result = await signInAnonymously(auth);
        return result.user;
    } catch (error) {
        console.error('Anonymous sign-in error:', error);
        return null;
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

export { app, database, auth, isFirebaseConfigured };
export default app;
