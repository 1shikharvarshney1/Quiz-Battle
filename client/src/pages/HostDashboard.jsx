import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/http.js';
import { Toast } from '../components/Toast.jsx';

export function HostDashboard() {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pastGames, setPastGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    fetchPastGames();
  }, []);

  async function fetchPastGames() {
    try {
      setLoadingGames(true);
      const games = await apiRequest('/api/games');
      setPastGames(games);
    } catch (err) {
      console.error('Failed to load past games:', err);
    } finally {
      setLoadingGames(false);
    }
  }

  async function handleCreateGame(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiRequest('/api/games', {
        method: 'POST',
        body: JSON.stringify({
          topic: topic.trim(),
          difficulty,
          questionCount: Number(questionCount),
          timeLimitSeconds: Number(timeLimitSeconds),
        }),
      });

      // Navigate to Host game room screen with the generated PIN
      navigate(`/host/game/${data.pin}`);
    } catch (err) {
      setError(err.message || 'Failed to create game. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: '860px' }}>
      <Toast message={error} onClose={() => setError('')} />

      <div style={{ margin: '2rem 0 1.5rem 0' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>Host Control Room</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Generate an AI-powered trivia game or explore your quiz history.
        </p>
      </div>

      {/* Game Creation Panel */}
      <div
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--bg-card-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          marginBottom: '2.5rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        }}
      >
        <h2 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>Create New Quiz</h2>

        <form onSubmit={handleCreateGame}>
          <div className="form-group">
            <label className="form-label">Quiz Topic</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. World Capitals, 90s Rock Music, Marvel Cinematic Universe, Quantum Physics"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              minLength={3}
              maxLength={80}
              required
            />
            <small style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
              Gemini AI generates questions based on your topic. If no API key is provided, the mock question bank is used.
            </small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Difficulty</label>
              <select
                className="form-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Number of Questions (3-10)</label>
              <input
                type="number"
                className="form-input"
                min={3}
                max={10}
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Seconds Per Question (10-30s)</label>
              <input
                type="number"
                className="form-input"
                min={10}
                max={30}
                value={timeLimitSeconds}
                onChange={(e) => setTimeLimitSeconds(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !topic.trim()}
            style={{ width: '100%', marginTop: '0.5rem', padding: '1rem', fontSize: '1.1rem' }}
          >
            {loading ? '🤖 AI is writing questions... Please wait' : '⚡ Generate Game & Open Lobby'}
          </button>
        </form>
      </div>

      {/* Past Games Panel */}
      <div>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Past Games</h2>
        {loadingGames ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading past games...</p>
        ) : pastGames.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'var(--bg-glass)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              border: '1px solid var(--bg-card-border)',
            }}
          >
            You haven't hosted any games yet. Create your first game above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pastGames.map((game) => (
              <div
                key={game.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--bg-card-border)',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.2rem' }}>
                    {game.topic}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    PIN: <strong style={{ color: '#38bdf8' }}>{game.pin}</strong> •{' '}
                    {new Date(game.date).toLocaleDateString()} • {game.difficulty} (
                    {game.questionCount} Qs)
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Players: <strong>{game.playerCount}</strong>
                    </div>
                    {game.winner && (
                      <div style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: 600 }}>
                        🏆 {game.winner}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.3rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      background: game.status === 'finished' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                      color: game.status === 'finished' ? '#4ade80' : '#818cf8',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {game.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
