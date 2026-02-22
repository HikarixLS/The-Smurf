/**
 * WatchParty Sync Engine
 * 
 * Handles video synchronization across multiple viewers using:
 * 1. postMessage API — communicate with the iframe player
 * 2. Heartbeat — periodic time sync checks
 * 3. Buffering detection — pause everyone when someone lags
 * 4. useRef flagging — prevent infinite update loops
 */

// ---- postMessage Bridge ----

/**
 * Send a command to the iframe player via postMessage.
 * Tries multiple message formats to cover common embed players
 * (ArtPlayer, JWPlayer, Plyr, VidStack, generic HTML5).
 */
export function sendPlayerCommand(iframe, command, value) {
    if (!iframe?.contentWindow) return;

    const origin = '*'; // Cross-origin, so we use wildcard

    // Format 1: ArtPlayer / ophim / opstream players
    iframe.contentWindow.postMessage(
        { type: 'player', command, value },
        origin
    );

    // Format 2: Generic HTML5 video bridge
    iframe.contentWindow.postMessage(
        JSON.stringify({ event: command, data: value }),
        origin
    );

    // Format 3: Direct action message
    iframe.contentWindow.postMessage({ action: command, value }, origin);
}

/**
 * Available commands:
 *  play      — resume playback
 *  pause     — pause playback
 *  seek      — seek to time in seconds (value = seconds)
 *  getTime   — request current playback time
 */

export const PlayerCommand = {
    PLAY: 'play',
    PAUSE: 'pause',
    SEEK: 'seek',
    GET_TIME: 'getTime',
};

// ---- Sync Logic ----

const SYNC_THRESHOLD_SECONDS = 3; // Max allowed drift before force-seek
const HEARTBEAT_INTERVAL_MS = 3000; // How often to sync (3 seconds)
const BUFFER_TIMEOUT_MS = 8000; // Consider buffering if no response in 8s

/**
 * Determines if a viewer needs to be re-synced
 * @param {number} viewerTime - Current time of this viewer
 * @param {number} hostTime - Current time of the host
 * @returns {{ needsSync: boolean, drift: number }}
 */
export function checkDrift(viewerTime, hostTime) {
    const drift = Math.abs(viewerTime - hostTime);
    return {
        needsSync: drift > SYNC_THRESHOLD_SECONDS,
        drift,
    };
}

/**
 * Calculate estimated host time accounting for network latency.
 * @param {number} hostTime - Last known host time
 * @param {number} hostTimestamp - When the host time was recorded (Date.now())
 * @param {boolean} isPlaying - Whether the host is playing
 * @returns {number} Estimated current host time
 */
export function estimateHostTime(hostTime, hostTimestamp, isPlaying) {
    if (!isPlaying || !hostTimestamp) return hostTime;
    const elapsed = (Date.now() - hostTimestamp) / 1000;
    return hostTime + elapsed;
}

/**
 * Creates a heartbeat manager that periodically syncs playback state.
 * Uses the "flag" pattern with refs to avoid React re-render loops.
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

// ---- Buffering Detection ----

/**
 * Creates a buffer detector.
 * If a viewer hasn't reported progress in BUFFER_TIMEOUT_MS,
 * they are considered to be buffering.
 */
export function createBufferDetector() {
    let lastProgressTime = Date.now();
    let lastVideoTime = 0;
    let isBuffering = false;

    return {
        /** Call on each time update from the player */
        reportProgress(videoTime) {
            if (Math.abs(videoTime - lastVideoTime) > 0.1) {
                lastProgressTime = Date.now();
                lastVideoTime = videoTime;
                isBuffering = false;
            }
        },

        /** Check if currently buffering */
        check() {
            if (Date.now() - lastProgressTime > BUFFER_TIMEOUT_MS) {
                isBuffering = true;
            }
            return isBuffering;
        },

        /** Reset state */
        reset() {
            lastProgressTime = Date.now();
            lastVideoTime = 0;
            isBuffering = false;
        },
    };
}

// ---- Inject postMessage listener into iframe ----

/**
 * Inject a script into the iframe that bridges postMessage commands
 * to the actual HTML5 <video> element inside the iframe.
 * This works even across origins because we communicate via postMessage.
 * 
 * The injected script listens for our commands and relays video state back.
 */
export function getInjectionScript() {
    return `
    (function() {
      if (window.__smurfSyncInjected) return;
      window.__smurfSyncInjected = true;

      function findVideo() {
        return document.querySelector('video');
      }

      // Listen for commands from parent
      window.addEventListener('message', function(e) {
        var video = findVideo();
        if (!video) return;

        var data = e.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch(err) { return; }
        }

        var cmd = data.command || data.action || data.event;
        var val = data.value || data.data;

        switch(cmd) {
          case 'play':
            video.play().catch(function(){});
            break;
          case 'pause':
            video.pause();
            break;
          case 'seek':
            if (typeof val === 'number') video.currentTime = val;
            break;
          case 'getTime':
            window.parent.postMessage({
              type: 'smurfSync',
              event: 'timeUpdate',
              currentTime: video.currentTime,
              duration: video.duration,
              paused: video.paused,
              buffering: video.readyState < 3,
            }, '*');
            break;
        }
      });

      // Periodically report state to parent
      setInterval(function() {
        var video = findVideo();
        if (!video) return;
        window.parent.postMessage({
          type: 'smurfSync',
          event: 'heartbeat',
          currentTime: video.currentTime,
          duration: video.duration,
          paused: video.paused,
          buffering: video.readyState < 3,
        }, '*');
      }, 2000);

      // Report play/pause events
      var video = findVideo();
      if (video) {
        video.addEventListener('play', function() {
          window.parent.postMessage({ type: 'smurfSync', event: 'play', currentTime: video.currentTime }, '*');
        });
        video.addEventListener('pause', function() {
          window.parent.postMessage({ type: 'smurfSync', event: 'pause', currentTime: video.currentTime }, '*');
        });
        video.addEventListener('seeked', function() {
          window.parent.postMessage({ type: 'smurfSync', event: 'seeked', currentTime: video.currentTime }, '*');
        });
        video.addEventListener('waiting', function() {
          window.parent.postMessage({ type: 'smurfSync', event: 'buffering', currentTime: video.currentTime }, '*');
        });
      }
    })();
  `;
}

export {
    SYNC_THRESHOLD_SECONDS,
    HEARTBEAT_INTERVAL_MS,
    BUFFER_TIMEOUT_MS,
};
