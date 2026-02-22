import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { routes } from './routes';

// Lazy load pages
import { lazy, Suspense, useEffect } from 'react';

// Auth & Analytics
import { AuthProvider, useAuth } from '@/services/firebase/AuthContext';
import { logPageView } from '@/services/firebase/config';

// Components
import Loader from '@/components/common/Loader/Loader';
import CursorGlow from '@/components/common/CursorGlow/CursorGlow';

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
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AppRouter = () => {
  return (
    <BrowserRouter basename="/The-Smurf">
      <CursorGlow />
      <AuthProvider>
        <AnalyticsTracker />
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
    </BrowserRouter>
  );
};

export default AppRouter;


