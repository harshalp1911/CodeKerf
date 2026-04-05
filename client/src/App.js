import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthSuccess from './components/Auth/AuthSuccess';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';
import './App.css';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <AuthProvider>
      <Router>
        <div className={`App ${darkMode ? 'dark' : ''}`}>
          <Routes>
            <Route path="/" element={<LandingPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
            <Route path="/auth-success" element={<AuthSuccess />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard darkMode={darkMode} setDarkMode={setDarkMode} />} />
              <Route path="/room/:id" element={<Room darkMode={darkMode} setDarkMode={setDarkMode} />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
