import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { routes } from './routes';

// Lazy load pages
import { lazy, Suspense, useEffect } from 'react';

// Auth & Analytics
import { AuthProvider, useAuth } from '@/services/firebase/AuthContext';
import { isFirebaseConfigured, logPageView } from '@/services/firebase/config';
import { isLowPerformanceMode } from '@/utils/device';

// Components
import Loader from '@/components/common/Loader/Loader';
import CursorGlow from '@/components/common/CursorGlow/CursorGlow';
import { ToastProvider } from '@/services/toast/ToastContext';
import LibraryUpdateWatcher from '@/components/common/LibraryUpdateWatcher/LibraryUpdateWatcher';

// Lazy loaded pages
const Home = lazy(() => import('@/pages/Home/Home'));
const Search = lazy(() => import('@/pages/Search/Search'));
const Browse = lazy(() => import('@/pages/Browse/Browse'));
const MovieDetail = lazy(() => import('@/pages/MovieDetail/MovieDetail'));
const Watch = lazy(() => import('@/pages/Watch/Watch'));
const WatchParty = lazy(() => import('@/pages/WatchParty/WatchParty'));
const WatchPartyRoom = lazy(() => import('@/pages/WatchParty/WatchPartyRoom'));
const Profile = lazy(() => import('@/pages/Profile/Profile'));
const Login = lazy(() => import('@/pages/Login/Login'));
const NotFound = lazy(() => import('@/pages/NotFound/NotFound'));
const AIAssistant = lazy(() => import('@/components/common/AIAssistant/AIAssistant'));

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
  }}>
    <Loader />
  </div>
);

const firebaseEnabled = isFirebaseConfigured();

// Track page views on route changes
const AnalyticsTracker = () => {
  const location = useLocation();
  useEffect(() => {
    logPageView(location.pathname, document.title);
  }, [location]);
  return null;
};

// Protected route - requires Google sign-in
const ProtectedRoute = ({ children }) => {
  if (!firebaseEnabled) return children;
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const baseName = import.meta.env.VITE_PLATFORM === 'android' ? '/' : '/The-Smurf';

// Hide the AI assistant on pages where it can obstruct auth/immersive flows
const ConditionalAI = ({ lowPerformanceMode = false }) => {
  const location = useLocation();
  const isLoginRoute =
    location.pathname === '/login' ||
    location.pathname.startsWith('/login/') ||
    location.pathname.endsWith('/login') ||
    location.pathname.endsWith('/login/');

  if (lowPerformanceMode) return null;
  if (location.pathname.startsWith('/watch-party')) return null;
  if (isLoginRoute) return null;
  return (
    <Suspense fallback={null}>
      <AIAssistant />
    </Suspense>
  );
};

const AppRouter = () => {
  const lowPerformanceMode = isLowPerformanceMode();

  return (
    <BrowserRouter basename={baseName}>
      <ToastProvider>
        {!lowPerformanceMode && <CursorGlow />}
        <ConditionalAI lowPerformanceMode={lowPerformanceMode} />
        <AuthProvider>
          <AnalyticsTracker />
          {!lowPerformanceMode && <LibraryUpdateWatcher />}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path={routes.HOME} element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path={routes.SEARCH} element={<ProtectedRoute><Search /></ProtectedRoute>} />
              <Route path={routes.BROWSE} element={<ProtectedRoute><Browse /></ProtectedRoute>} />
              <Route path={routes.MOVIE_DETAIL} element={<ProtectedRoute><MovieDetail /></ProtectedRoute>} />
              <Route path={routes.WATCH} element={<ProtectedRoute><Watch /></ProtectedRoute>} />
              <Route path={routes.WATCH_PARTY} element={<ProtectedRoute><Watch /></ProtectedRoute>} />
              <Route path="/watch-party" element={<ProtectedRoute><WatchParty /></ProtectedRoute>} />
              <Route path="/watch-party/room/:roomId" element={<ProtectedRoute><WatchPartyRoom /></ProtectedRoute>} />
              <Route path={routes.PROFILE} element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path={routes.WATCHLIST} element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path={routes.HISTORY} element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path={routes.NOT_FOUND} element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default AppRouter;


