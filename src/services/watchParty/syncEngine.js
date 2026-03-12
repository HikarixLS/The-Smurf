/**
 * WatchParty Sync Engine
 *
 * Handles video synchronization across multiple viewers using:
 * 1. Firebase Realtime Database — single source of truth for playback state
 * 2. Heartbeat — periodic time sync fallback (5s), immediate for play/pause/seek
 * 3. Server-timestamp latency compensation — uses Firebase serverTimeOffset
 * 4. Global playback barrier — waits for ALL members before resuming
 * 5. useRef flagging — isSyncing prevents feedback loops
 *
 * NOTE: postMessage / iframe injection was removed.
 * Cross-origin iframes block all postMessage commands due to CORS policy.
 * Sync only works for HLS (m3u8) streams rendered with our own <video> element.
 */

// ---- Constants ----

/** Max drift (seconds) before a force-seek is issued.
 *  Set to 2.5s to avoid excessive seeks for viewers with high delivery latency (e.g. users in the US). */
export const SYNC_THRESHOLD_SECONDS = 2.5;

/**
 * Extra seconds added to the estimated host time to compensate for Firebase
 * real-time delivery delay (typically 100–800 ms depending on region).
 * Prevents viewers on far-away servers from appearing behind the host.
 */
export const DELIVERY_LATENCY_BUFFER_SEC = 0.3;

/** Host broadcasts position every N ms as fallback drift correction */
export const HEARTBEAT_INTERVAL_MS = 5000;

/** Consider player stalled if no timeupdate progress for this long */
export const BUFFER_TIMEOUT_MS = 8000;

// ---- Drift check ----

/**
 * Determines if a viewer needs to be force-synced.
 * @param {number} viewerTime - Current playback time of this viewer (seconds)
 * @param {number} estimatedHostTime - Interpolated host time (seconds)
 * @returns {{ needsSync: boolean, drift: number }}
 */
export function checkDrift(viewerTime, estimatedHostTime) {
  const drift = Math.abs(viewerTime - estimatedHostTime);
  return {
    needsSync: drift > SYNC_THRESHOLD_SECONDS,
    drift,
  };
}

// ---- Time interpolation ----

/**
 * Estimate the host's current playback position, accounting for network latency.
 * When the host is playing, time advances even between Firebase updates.
 *
 * @param {number}   hostTime      - Last known host currentTime (seconds)
 * @param {number}   hostTimestamp - When that value was written (server ms, from Firebase)
 * @param {boolean}  isPlaying     - Whether the host was playing at that moment
 * @param {number}   serverOffset  - Firebase .info/serverTimeOffset (ms). Default 0.
 * @param {Function} [getTrueMs]   - Optional: replaces Date.now()+offset for server-corrected time
 * @returns {number} Estimated current host time (seconds)
 */
export function estimateHostTime(hostTime, hostTimestamp, isPlaying, serverOffset = 0, getTrueMs = null) {
  if (!isPlaying || !hostTimestamp) return hostTime ?? 0;
  // Use injected getTrueMs (server-corrected) or fall back to Date.now() + offset
  const nowMs = getTrueMs ? getTrueMs() : (Date.now() + serverOffset);
  const elapsedSec = (nowMs - hostTimestamp) / 1000;
  // Cap at 30s to avoid massive jumps on reconnect
  return (hostTime ?? 0) + Math.min(Math.max(0, elapsedSec), 30);
}

// ---- Global barrier check ----

/**
 * Returns true when every member in the room has finished buffering.
 * @param {Object} members - Firebase members map: { [id]: { isBuffering: boolean, ... } }
 * @returns {boolean}
 */
export function allMembersReady(members) {
  if (!members) return true;
  return Object.values(members).every((m) => !m.isBuffering);
}

// ---- Heartbeat manager ----

/**
 * Creates a heartbeat that periodically fires a callback.
 * Used by the Host only — fires every HEARTBEAT_INTERVAL_MS as a
 * drift-correction fallback. Play/pause/seek/speed sync happens immediately
 * via direct watchPartyService.syncPlayback calls, not via heartbeat.
 *
 * @param {Function} onTick - Called on each interval
 * @returns {{ start: Function, stop: Function }}
 */
export function createHeartbeat(onTick) {
  let intervalId = null;

  return {
    start() {
      this.stop();
      intervalId = setInterval(onTick, HEARTBEAT_INTERVAL_MS);
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}

// ---- Throttle helper ----

/**
 * Creates a throttle wrapper that guarantees the first call fires immediately
 * and subsequent calls within `ms` are suppressed.
 * Useful for heartbeat-style Firebase writes that need a leading-edge call on
 * play/pause but should not flood the database during normal playback.
 *
 * @param {Function} fn - Function to throttle
 * @param {number}   ms - Throttle window in milliseconds
 * @returns {Function}
 */
export function createThrottle(fn, ms) {
  let lastCall = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ---- Buffering detector ----

/**
 * Tracks whether the local player is stalling.
 * Call reportProgress() on each timeupdate event.
 * Call check() to detect stalls.
 */
export function createBufferDetector() {
  let lastProgressTime = Date.now();
  let lastVideoTime = 0;
  let isBuffering = false;

  return {
    /** Call on each timeupdate from the player */
    reportProgress(videoTime) {
      if (Math.abs(videoTime - lastVideoTime) > 0.1) {
        lastProgressTime = Date.now();
        lastVideoTime = videoTime;
        isBuffering = false;
      }
    },

    /** Returns true if the player appears to be stalled */
    check() {
      if (Date.now() - lastProgressTime > BUFFER_TIMEOUT_MS) {
        isBuffering = true;
      }
      return isBuffering;
    },

    /** Reset (call on source change or seek) */
    reset() {
      lastProgressTime = Date.now();
      lastVideoTime = 0;
      isBuffering = false;
    },
  };
}
