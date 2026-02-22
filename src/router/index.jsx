import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { routes } from './routes';

// Lazy load pages
import { lazy, Suspense } from 'react';

// Components
import Loader from '@/components/common/Loader/Loader';

// Lazy loaded pages
const Home = lazy(() => import('@/pages/Home/Home'));
const Search = lazy(() => import('@/pages/Search/Search'));
const Browse = lazy(() => import('@/pages/Browse/Browse'));
const MovieDetail = lazy(() => import('@/pages/MovieDetail/MovieDetail'));
const Watch = lazy(() => import('@/pages/Watch/Watch'));
const WatchParty = lazy(() => import('@/pages/WatchParty/WatchParty'));
const WatchPartyRoom = lazy(() => import('@/pages/WatchParty/WatchPartyRoom'));
const Profile = lazy(() => import('@/pages/Profile/Profile'));
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

const AppRouter = () => {
  return (
    <BrowserRouter basename="/The-Smurf">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path={routes.HOME} element={<Home />} />
          <Route path={routes.SEARCH} element={<Search />} />
          <Route path={routes.BROWSE} element={<Browse />} />
          <Route path={routes.MOVIE_DETAIL} element={<MovieDetail />} />
          <Route path={routes.WATCH} element={<Watch />} />
          <Route path={routes.WATCH_PARTY} element={<Watch />} />
          <Route path="/watch-party" element={<WatchParty />} />
          <Route path="/watch-party/room/:roomId" element={<WatchPartyRoom />} />
          <Route path={routes.PROFILE} element={<Profile />} />
          <Route path={routes.WATCHLIST} element={<Profile />} />
          <Route path={routes.HISTORY} element={<Profile />} />
          <Route path={routes.NOT_FOUND} element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
