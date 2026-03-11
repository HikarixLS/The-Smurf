/**
 * Watch Party Notification Service
 * Uses in-app Toast notifications — no browser permission required.
 * Import showToast from ToastContext and call it directly.
 */
import { showToast } from '@/services/toast/ToastContext';

/**
 * Pre-built notification senders for Watch Party events
 */
export const WPNotify = {
    memberJoined: (name) =>
        showToast(`👤 ${name} đã vào phòng`, 'info', 4000),

    memberLeft: (name) =>
        showToast(`🚪 ${name} đã rời phòng`, 'warning', 3000),

    hostPlayed: (hostName) =>
        showToast(`▶️ ${hostName} đã phát video`, 'info', 3000),

    hostPaused: (hostName) =>
        showToast(`⏸️ ${hostName} đã dừng video`, 'info', 3000),

    hostChangedEpisode: (hostName, epName) =>
        showToast(`📺 ${hostName} đã chuyển sang ${epName}`, 'info', 4000),

    hostPromoted: (name) =>
        showToast(`👑 ${name} đã trở thành chủ phòng`, 'success', 5000),
};

// Keep these as no-ops for backward compatibility (no longer needed)
export const requestNotificationPermission = async () => true;
export const sendNotification = () => {};
