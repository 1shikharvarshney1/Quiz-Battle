import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/host/login');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        ⚡ <span>Quiz</span>Battle
      </Link>
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/host" className="nav-link">
              Dashboard ({user.username})
            </Link>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              Logout
            </button>
          </>
        ) : (
          <Link to="/host/login" className="nav-link">
            Host Login
          </Link>
        )}
      </div>
    </nav>
  );
}
