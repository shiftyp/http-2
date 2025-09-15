import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ContentCreator from './pages/ContentCreator';
import PageBuilder from './pages/PageBuilder';
import DatabaseManager from './pages/DatabaseManager';
import RadioOps from './pages/RadioOps';
import Browse from './pages/Browse';
import Settings from './pages/Settings';
import ProtobufTest from './pages/ProtobufTest';
import InstallPrompt from './components/InstallPrompt/InstallPrompt';
import { db } from './lib/database';
import './App.css';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [callsign, setCallsign] = useState('');

  useEffect(() => {
    // Initialize database
    db.init().then(() => {
      setDbReady(true);
      // Load callsign from localStorage
      const savedCallsign = localStorage.getItem('callsign');
      if (savedCallsign) {
        setCallsign(savedCallsign);
      }
    }).catch(err => {
      console.error('Failed to initialize database:', err);
    });

    // Handle online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check if should show install prompt
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (!isInstalled && !localStorage.getItem('dismissedInstallPrompt')) {
      setShowInstallPrompt(true);
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!dbReady) {
    return (
      <div className="app">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Initializing database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app bg-gray-900 text-white min-h-screen">
        <header className="app-header bg-gray-800 border-b border-gray-700">
          <nav className="navbar">
            <div className="navbar-brand">
              <h1 className="text-blue-400">HTTP-over-Radio</h1>
              <div className="flex items-center gap-3">
                {callsign && (
                  <span className="text-sm text-gray-400">
                    Station: <span className="font-bold text-white">{callsign}</span>
                  </span>
                )}
                <span className={`status-indicator ${isOnline ? 'text-green-400' : 'text-yellow-400'}`}>
                  {isOnline ? '● Online' : '● Offline'}
                </span>
              </div>
            </div>
            <ul className="navbar-menu">
              <li>
                <NavLink 
                  to="/" 
                  className={({ isActive }) => isActive ? 'bg-gray-700 text-blue-400' : ''}
                >
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/content"
                  className={({ isActive }) => isActive ? 'bg-gray-700 text-blue-400' : ''}
                >
                  Content
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/page-builder"
                  className={({ isActive }) => isActive ? 'bg-gray-700 text-blue-400' : ''}
                >
                  Page Builder
                </NavLink>
              </li>
              <li>
                <NavLink 
                  to="/database"
                  className={({ isActive }) => isActive ? 'bg-gray-700 text-blue-400' : ''}
                >
                  Database
                </NavLink>
              </li>
              <li>
                <NavLink 
                  to="/radio"
                  className={({ isActive }) => isActive ? 'bg-gray-700 text-blue-400' : ''}
                >
                  Radio
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/browse"
                  className={({ isActive }) => isActive ? 'bg-gray-700 text-blue-400' : ''}
                >
                  Browse
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/protobuf-test"
                  className={({ isActive }) => isActive ? 'bg-gray-700 text-blue-400' : ''}
                >
                  🧪 Protobuf Test
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/settings"
                  className={({ isActive }) => isActive ? 'bg-gray-700 text-blue-400' : ''}
                >
                  Settings
                </NavLink>
              </li>
            </ul>
          </nav>
        </header>
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/content/*" element={<ContentCreator />} />
            <Route path="/page-builder" element={<PageBuilder />} />
            <Route path="/database" element={<DatabaseManager />} />
            <Route path="/radio" element={<RadioOps />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/protobuf-test" element={<ProtobufTest />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        
        {showInstallPrompt && (
          <InstallPrompt onClose={() => {
            setShowInstallPrompt(false);
            localStorage.setItem('dismissedInstallPrompt', 'true');
          }} />
        )}
      </div>
    </Router>
  );
}

export default App;