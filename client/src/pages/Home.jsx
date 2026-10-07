import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';

export function Home() {
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    function handleJoined(data) {
      setLoading(false);
      // Persist player credentials in sessionStorage
      sessionStorage.setItem(
        'player_session',
        JSON.stringify({
          pin: pin.trim(),
          nickname: data.nickname,
          playerId: data.playerId,
        })
      );
      navigate(`/play/${pin.trim()}`);
    }

    function handleError(data) {
      setLoading(false);
      setError(data.message || 'Failed to join game');
    }

    socket.on('player:joined', handleJoined);
    socket.on('player:error', handleError);

    return () => {
      socket.off('player:joined', handleJoined);
      socket.off('player:error', handleError);
    };
  }, [socket, pin, navigate]);

  function handleJoin(e) {
    e.preventDefault();
    setError('');

    const cleanPin = pin.trim();
    const cleanNick = nickname.trim();

    if (!cleanPin || cleanPin.length !== 6) {
      setError('Please enter a valid 6-digit game PIN');
      return;
    }

    if (!cleanNick || cleanNick.length < 2 || cleanNick.length > 16) {
      setError('Nickname must be between 2 and 16 characters');
      return;
    }

    if (!connected) {
      setError('Connecting to server... Please try again in a moment');
      return;
    }

    setLoading(true);
    socket.emit('player:join', {
      pin: cleanPin,
      nickname: cleanNick,
    });
  }

  return (
    <div className="container">
      <div className="center-card" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>
          ⚡ <span>Quiz</span> Battle
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Enter a PIN to jump into a live Kahoot-style quiz!
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(225, 29, 72, 0.15)',
              border: '1px solid rgba(225, 29, 72, 0.4)',
              color: '#fda4af',
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              fontSize: '0.95rem',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleJoin}>
          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="GAME PIN (6 digits)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                textAlign: 'center',
                fontSize: '1.5rem',
                letterSpacing: '0.2em',
                fontWeight: 700,
              }}
              required
            />
          </div>

          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="Enter your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 16))}
              style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 600 }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || pin.length !== 6 || !nickname.trim()}
            style={{ padding: '1rem', fontSize: '1.15rem' }}
          >
            {loading ? 'Joining Game...' : 'Join Game'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--bg-card-border)', paddingTop: '1.5rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Want to create and host your own quiz?{' '}
            <Link to="/host/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
              Host a game
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
