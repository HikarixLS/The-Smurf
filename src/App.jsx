import AppRouter from './router';
import './assets/styles/variables.css';
import './assets/styles/glass-effects.css';
import './assets/styles/global.css';
import './App.css';

function App() {
  return (
    <div className="app" data-theme="dark">
      <AppRouter />
    </div>
  );
}

export default App;
