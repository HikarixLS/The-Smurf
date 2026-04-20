import { useEffect } from 'react';
import AppRouter from './router';
import { isLowPerformanceMode } from '@/utils/device';
import './assets/styles/variables.css';
import './assets/styles/glass-effects.css';
import './assets/styles/global.css';
import './App.css';

function App() {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const html = document.documentElement;
    const perfLite = isLowPerformanceMode();
    html.classList.toggle('perf-lite', perfLite);

    return () => {
      html.classList.remove('perf-lite');
    };
  }, []);

  return (
    <div className="app" data-theme="dark">
      <AppRouter />
    </div>
  );
}

export default App;
