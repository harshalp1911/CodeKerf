import React from 'react';
import { Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Skip authentication for UI testing - will implement later
  return <Outlet />;
};

export default ProtectedRoute;
