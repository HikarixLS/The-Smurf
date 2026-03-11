import { ref, set, get, remove, onValue, off } from 'firebase/database';
import { database } from './config';

const PROGRESS_REF = 'userWatchProgress';

const WATCHLIST_REF = 'userWatchlists';
const FAVORITES_REF = 'userFavorites';
const HISTORY_REF = 'userHistory';

// ---- Watchlist (Lưu lại) ----

export const addToWatchlist = async (userId, movie) => {
    if (!database || !userId) return;
    const itemSlug = movie.slug || movie._id;
    if (!itemSlug) { console.warn('[Watchlist] Cannot add item with no slug or _id', movie); return; }
    const itemRef = ref(database, `${WATCHLIST_REF}/${userId}/${itemSlug}`);
    await set(itemRef, {
        slug: itemSlug,
        name: movie.name,
        origin_name: movie.origin_name || '',
        thumb_url: movie.thumb_url || movie.poster_url || '',
        year: movie.year || '',
        quality: movie.quality || '',
        addedAt: Date.now(),
    });
};

export const removeFromWatchlist = async (userId, slug) => {
    if (!database || !userId) return;
    await remove(ref(database, `${WATCHLIST_REF}/${userId}/${slug}`));
};

export const isInWatchlist = async (userId, slug) => {
    if (!database || !userId) return false;
    const snapshot = await get(ref(database, `${WATCHLIST_REF}/${userId}/${slug}`));
    return snapshot.exists();
};

export const getWatchlist = async (userId) => {
    if (!database || !userId) return [];
    const snapshot = await get(ref(database, `${WATCHLIST_REF}/${userId}`));
    if (!snapshot.exists()) return [];
    const items = [];
    snapshot.forEach(child => items.push(child.val()));
    return items.sort((a, b) => b.addedAt - a.addedAt);
};

// ---- Favorites (Yêu thích) ----

export const addToFavorites = async (userId, movie) => {
    if (!database || !userId) return;
    const itemSlug = movie.slug || movie._id;
    if (!itemSlug) { console.warn('[Favorites] Cannot add item with no slug or _id', movie); return; }
    const itemRef = ref(database, `${FAVORITES_REF}/${userId}/${itemSlug}`);
    await set(itemRef, {
        slug: itemSlug,
        name: movie.name,
        origin_name: movie.origin_name || '',
        thumb_url: movie.thumb_url || movie.poster_url || '',
        year: movie.year || '',
        quality: movie.quality || '',
        addedAt: Date.now(),
    });
};

export const removeFromFavorites = async (userId, slug) => {
    if (!database || !userId) return;
    await remove(ref(database, `${FAVORITES_REF}/${userId}/${slug}`));
};

export const isInFavorites = async (userId, slug) => {
    if (!database || !userId) return false;
    const snapshot = await get(ref(database, `${FAVORITES_REF}/${userId}/${slug}`));
    return snapshot.exists();
};

export const getFavorites = async (userId) => {
    if (!database || !userId) return [];
    const snapshot = await get(ref(database, `${FAVORITES_REF}/${userId}`));
    if (!snapshot.exists()) return [];
    const items = [];
    snapshot.forEach(child => items.push(child.val()));
    return items.sort((a, b) => b.addedAt - a.addedAt);
};

// ---- Watch History ----

export const addToHistory = async (userId, movie) => {
    if (!database || !userId) return;
    const itemSlug = movie.slug || movie._id;
    if (!itemSlug) { console.warn('[History] Cannot add item with no slug or _id', movie); return; }
    const itemRef = ref(database, `${HISTORY_REF}/${userId}/${itemSlug}`);
    await set(itemRef, {
        slug: itemSlug,
        name: movie.name,
        origin_name: movie.origin_name || '',
        thumb_url: movie.thumb_url || movie.poster_url || '',
        year: movie.year || '',
        watchedAt: Date.now(),
    });
};

export const getHistory = async (userId) => {
    if (!database || !userId) return [];
    const snapshot = await get(ref(database, `${HISTORY_REF}/${userId}`));
    if (!snapshot.exists()) return [];
    const items = [];
    snapshot.forEach(child => items.push(child.val()));
    return items.sort((a, b) => b.watchedAt - a.watchedAt);
};

// ---- Watch Progress (Tiến trình xem) ----

export const saveWatchProgress = async (userId, slug, { currentTime, duration, episodeIndex = 0, serverIndex = 0 }) => {
    if (!database || !userId || !slug) return;
    if (!duration || duration <= 0) return;
    const percent = currentTime / duration;
    // Nếu đã xem > 95% thì xóa tiến trình (coi như xem xong)
    if (percent >= 0.95) {
        await remove(ref(database, `${PROGRESS_REF}/${userId}/${slug}`));
        return;
    }
    const itemRef = ref(database, `${PROGRESS_REF}/${userId}/${slug}`);
    await set(itemRef, {
        slug,
        currentTime,
        duration,
        percent,
        episodeIndex,
        serverIndex,
        savedAt: Date.now(),
    });
};

export const getWatchProgress = async (userId, slug) => {
    if (!database || !userId || !slug) return null;
    const snapshot = await get(ref(database, `${PROGRESS_REF}/${userId}/${slug}`));
    return snapshot.exists() ? snapshot.val() : null;
};

export const clearWatchProgress = async (userId, slug) => {
    if (!database || !userId || !slug) return;
    await remove(ref(database, `${PROGRESS_REF}/${userId}/${slug}`));
};

