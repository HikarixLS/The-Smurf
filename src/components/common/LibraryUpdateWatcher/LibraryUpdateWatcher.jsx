import { useEffect } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '@/services/firebase/config';
import { useAuth } from '@/services/firebase/AuthContext';
import { movieService } from '@/services/api/movieService';
import { showToast } from '@/services/toast/ToastContext';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const STORAGE_PREFIX = 'smurf_library_update_snapshots_v1';
const MAX_TOASTS_PER_CHECK = 3;

const readSnapshot = (userId) => {
  if (typeof window === 'undefined' || !userId) return { bySlug: {} };
  const key = `${STORAGE_PREFIX}:${userId}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { bySlug: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { bySlug: {} };
    return {
      bySlug: parsed.bySlug && typeof parsed.bySlug === 'object' ? parsed.bySlug : {},
    };
  } catch {
    return { bySlug: {} };
  }
};

const writeSnapshot = (userId, data) => {
  if (typeof window === 'undefined' || !userId) return;
  const key = `${STORAGE_PREFIX}:${userId}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore localStorage errors (private mode / quota)
  }
};

const snapshotToMap = (snapshot) => {
  if (!snapshot.exists()) return {};
  const result = {};
  snapshot.forEach((child) => {
    const value = child.val() || {};
    const slug = value.slug || child.key;
    if (!slug) return;
    result[slug] = {
      slug,
      name: value.origin_name || value.name || slug,
    };
  });
  return result;
};

const normalizeMovieRecord = (movie, fallbackName = '') => {
  const name = movie?.origin_name || movie?.name || fallbackName || 'Phim';
  const episodeCurrent = String(movie?.episode_current || '').trim();
  const status = String(movie?.status || '').trim();
  const modified = movie?.modified;
  const modifiedToken = typeof modified === 'object'
    ? JSON.stringify(modified)
    : String(modified || '');

  return {
    name,
    episodeCurrent,
    status,
    modifiedToken,
    signature: `${episodeCurrent}|${status}|${modifiedToken}`,
    checkedAt: Date.now(),
  };
};

const listLabel = (inFavorites, inWatchlist) => {
  if (inFavorites && inWatchlist) return 'Yêu thích + Watchlist';
  if (inFavorites) return 'Yêu thích';
  return 'Watchlist';
};

const updateDescription = (prevRecord, nextRecord) => {
  if (prevRecord?.episodeCurrent !== nextRecord.episodeCurrent && nextRecord.episodeCurrent) {
    return `đã có cập nhật mới: ${nextRecord.episodeCurrent}`;
  }
  if (prevRecord?.status !== nextRecord.status && nextRecord.status) {
    return `trạng thái mới: ${nextRecord.status}`;
  }
  return 'đã có cập nhật mới';
};

const LibraryUpdateWatcher = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid || !database) return undefined;

    let disposed = false;
    let checking = false;
    let favorites = {};
    let watchlist = {};
    let favoritesReady = false;
    let watchlistReady = false;
    let debounceTimer = null;
    let intervalTimer = null;

    const ensureInterval = () => {
      if (intervalTimer || !favoritesReady || !watchlistReady) return;
      intervalTimer = window.setInterval(() => {
        void checkLibraryUpdates();
      }, CHECK_INTERVAL_MS);
    };

    const scheduleCheck = (delayMs = 1200) => {
      if (!favoritesReady || !watchlistReady || disposed) return;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void checkLibraryUpdates();
      }, delayMs);
    };

    const checkLibraryUpdates = async () => {
      if (disposed || checking || !favoritesReady || !watchlistReady) return;
      checking = true;

      try {
        const trackedBySlug = {};

        Object.values(favorites).forEach((item) => {
          trackedBySlug[item.slug] = {
            slug: item.slug,
            fallbackName: item.name,
            inFavorites: true,
            inWatchlist: false,
          };
        });

        Object.values(watchlist).forEach((item) => {
          if (trackedBySlug[item.slug]) {
            trackedBySlug[item.slug].inWatchlist = true;
          } else {
            trackedBySlug[item.slug] = {
              slug: item.slug,
              fallbackName: item.name,
              inFavorites: false,
              inWatchlist: true,
            };
          }
        });

        const trackedMovies = Object.values(trackedBySlug);
        const prevSnapshot = readSnapshot(user.uid);
        const prevBySlug = prevSnapshot.bySlug || {};
        const nextBySlug = {};

        if (trackedMovies.length === 0) {
          writeSnapshot(user.uid, { bySlug: {} });
          return;
        }

        const detailResults = await Promise.allSettled(
          trackedMovies.map((movie) => movieService.getMovieDetail(movie.slug))
        );

        const updates = [];

        detailResults.forEach((result, index) => {
          const trackedMovie = trackedMovies[index];
          if (!trackedMovie) return;

          const prevRecord = prevBySlug[trackedMovie.slug];

          if (result.status === 'fulfilled' && result.value?.data?.item) {
            const nextRecord = normalizeMovieRecord(result.value.data.item, trackedMovie.fallbackName);
            nextBySlug[trackedMovie.slug] = nextRecord;

            if (prevRecord?.signature && prevRecord.signature !== nextRecord.signature) {
              updates.push({
                ...trackedMovie,
                prevRecord,
                nextRecord,
              });
            }
            return;
          }

          // Preserve previous snapshot on transient API errors
          if (prevRecord) {
            nextBySlug[trackedMovie.slug] = prevRecord;
          } else {
            nextBySlug[trackedMovie.slug] = normalizeMovieRecord(null, trackedMovie.fallbackName);
          }
        });

        writeSnapshot(user.uid, { bySlug: nextBySlug });

        if (!disposed && updates.length > 0) {
          updates.slice(0, MAX_TOASTS_PER_CHECK).forEach((update) => {
            const label = listLabel(update.inFavorites, update.inWatchlist);
            const text = updateDescription(update.prevRecord, update.nextRecord);
            showToast(`${update.nextRecord.name} (${label}) ${text}`, 'info', 6500);
          });

          if (updates.length > MAX_TOASTS_PER_CHECK) {
            showToast(
              `Bạn còn ${updates.length - MAX_TOASTS_PER_CHECK} phim khác vừa có cập nhật mới`,
              'info',
              6500,
            );
          }
        }
      } catch (error) {
        console.warn('[LibraryUpdateWatcher] Check failed:', error);
      } finally {
        checking = false;
      }
    };

    const favoritesRef = ref(database, `userFavorites/${user.uid}`);
    const watchlistRef = ref(database, `userWatchlists/${user.uid}`);

    const unsubFavorites = onValue(favoritesRef, (snapshot) => {
      favorites = snapshotToMap(snapshot);
      favoritesReady = true;
      ensureInterval();
      scheduleCheck();
    });

    const unsubWatchlist = onValue(watchlistRef, (snapshot) => {
      watchlist = snapshotToMap(snapshot);
      watchlistReady = true;
      ensureInterval();
      scheduleCheck();
    });

    return () => {
      disposed = true;
      unsubFavorites();
      unsubWatchlist();
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (intervalTimer) window.clearInterval(intervalTimer);
    };
  }, [user?.uid]);

  return null;
};

export default LibraryUpdateWatcher;