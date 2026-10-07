import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { Navbar } from './components/Navbar.jsx';

import { Home } from './pages/Home.jsx';
import { HostLogin } from './pages/HostLogin.jsx';
import { HostDashboard } from './pages/HostDashboard.jsx';
import { HostGame } from './pages/HostGame.jsx';
import { PlayGame } from './pages/PlayGame.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
        Loading session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/host/login" replace />;
  }

  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              {/* Guest player routes */}
              <Route path="/" element={<Home />} />
              <Route path="/play/:pin" element={<PlayGame />} />

              {/* Host authentication & control routes */}
              <Route path="/host/login" element={<HostLogin />} />
              <Route
                path="/host"
                element={
                  <ProtectedRoute>
                    <HostDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/host/game/:pin"
                element={
                  <ProtectedRoute>
                    <HostGame />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
export default App;
