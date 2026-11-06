import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Where to send the user once they log in. sessionStorage survives the Google login redirect.
export const REDIRECT_KEY = 'redirectAfterLogin';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!user) {
    try {
      sessionStorage.setItem(REDIRECT_KEY, location.pathname);
    } catch (_) { /* storage blocked: the user just lands on the home page after login */ }
    // There is no separate login page; the home page opens the login modal
    return <Navigate to="/" replace state={{ openLogin: true }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
