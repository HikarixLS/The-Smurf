/**
 * WatchParty Sync Engine
 *
 * Handles video synchronization across multiple viewers using:
 * 1. Firebase Realtime Database — single source of truth for playback state
 * 2. Heartbeat — periodic time sync as fallback (event-driven for play/pause/seek)
 * 3. Time interpolation — estimateHostTime() accounts for network latency
 * 4. useRef flagging — isSyncing prevents feedback loops
 *
 * NOTE: postMessage / iframe injection was removed.
 * Cross-origin iframes (ophim, kkphim embed players) block all postMessage
 * commands due to browser CORS policy. Sync only works for HLS (m3u8) streams
 * rendered with our own <video> element.
 */

// ---- Constants ----

export const SYNC_THRESHOLD_SECONDS = 3;  // Max drift (seconds) before force-seek
export const HEARTBEAT_INTERVAL_MS = 8000; // Host broadcasts position every 8s (event-driven for play/pause/seek)
export const BUFFER_TIMEOUT_MS = 8000; // Consider buffering if no progress for 8s

// ---- Drift check ----

/**
 * Determines if a viewer needs to be force-synced.
 * @param {number} viewerTime - Current playback time of this viewer
 * @param {number} hostTime   - Last known host time
 * @returns {{ needsSync: boolean, drift: number }}
 */
export function checkDrift(viewerTime, hostTime) {
  const drift = Math.abs(viewerTime - hostTime);
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
 * @param {number}  hostTime      - Last known host currentTime (seconds)
 * @param {number}  hostTimestamp - When that value was written (Date.now() ms)
 * @param {boolean} isPlaying     - Whether the host was playing at that moment
 * @returns {number} Estimated current host time
 */
export function estimateHostTime(hostTime, hostTimestamp, isPlaying) {
  if (!isPlaying || !hostTimestamp) return hostTime;
  const elapsed = (Date.now() - hostTimestamp) / 1000;
  // Cap at 10 seconds to avoid huge jumps on reconnect
  return hostTime + Math.min(elapsed, 10);
}

// ---- Heartbeat manager ----

/**
 * Creates a heartbeat that periodically fires a callback.
 * Used by the Host only — fires every HEARTBEAT_INTERVAL_MS as a
 * drift-correction fallback. Play/pause/seek sync happens immediately via
 * direct watchPartyService.syncPlayback calls, not via heartbeat.
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

// ---- Buffering detector ----

/**
 * Tracks whether the local player is buffering.
 * Call reportProgress() on each timeupdate event.
 * Call check() periodically to detect stalls.
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
