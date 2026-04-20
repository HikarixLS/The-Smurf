const toText = (value) => String(value || '').toLowerCase();

export const isNativeAndroid = () => {
  if (typeof window === 'undefined') return false;
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform?.()) return false;
  return capacitor.getPlatform?.() === 'android';
};

export const isAndroidTv = () => {
  if (typeof window === 'undefined') return false;

  const userAgent = toText(window.navigator?.userAgent);
  const hasTvSignature = /android tv|googletv|smarttv|smart-tv|bravia|hbbtv|aft[a-z0-9_-]*/.test(userAgent);

  // Guard by Android context to avoid false positives from desktop browsers.
  const inAndroidContext = isNativeAndroid() || userAgent.includes('android');
  return inAndroidContext && hasTvSignature;
};

export const isLowPerformanceMode = () => {
  if (typeof window === 'undefined') return false;
  // Keep website behavior unchanged: perf-lite is only for native Android TV app.
  return isAndroidTv();
};
