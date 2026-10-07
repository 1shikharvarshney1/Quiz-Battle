import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
import { CountdownBar } from '../components/CountdownBar.jsx';
import { ResultsChart } from '../components/ResultsChart.jsx';
import { Leaderboard } from '../components/Leaderboard.jsx';
import { Toast } from '../components/Toast.jsx';
import { useCountdown } from '../hooks/useCountdown.js';

export function HostGame() {
  const { pin } = useParams();
  const { socket, connected, isReconnecting } = useSocket();
  const navigate = useNavigate();

  // State
  const [gameState, setGameState] = useState('lobby'); // 'lobby' | 'question' | 'reveal' | 'finished'
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalConnected, setTotalConnected] = useState(0);
  const [revealData, setRevealData] = useState(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [error, setError] = useState('');

  // Synchronized countdown hook for question phase
  const { percentage, remainingSeconds } = useCountdown(
    currentQuestion?.endsAt || null,
    currentQuestion?.serverNow || null,
    currentQuestion?.timeLimitMs || 20000
  );

  useEffect(() => {
    if (!socket || !connected) return;

    // Join room as host
    socket.emit('host:join', { pin });

    // 1. Initial or full reconnect state
    function handleHostState(data) {
      setGameState(data.status);
      if (data.players) setPlayers(data.players);
      if (data.currentQuestion) setCurrentQuestion(data.currentQuestion);
      if (typeof data.answeredCount === 'number') setAnsweredCount(data.answeredCount);
      if (typeof data.totalPlayers === 'number') setTotalConnected(data.totalPlayers);
    }

    // 2. Lobby updates as players join or disconnect
    function handleLobbyUpdate(data) {
      setPlayers(data.players || []);
    }

    // 3. Question starts
    function handleQuestionShow(data) {
      setGameState('question');
      setCurrentQuestion(data);
      setRevealData(null);
      setAnsweredCount(0);
    }

    // 4. Live answered progress
    function handleAnswerCount(data) {
      setAnsweredCount(data.answered);
      setTotalConnected(data.total);
    }

    // 5. Question reveal
    function handleQuestionReveal(data) {
      setGameState('reveal');
      setRevealData(data);
    }

    // 6. Game finished
    function handleGameFinished(data) {
      setGameState('finished');
      setFinalLeaderboard(data.leaderboard || []);
    }

    // Errors
    function handleAppError(data) {
      setError(data.message || 'An error occurred');
    }

    socket.on('host:state', handleHostState);
    socket.on('lobby:update', handleLobbyUpdate);
    socket.on('question:show', handleQuestionShow);
    socket.on('answer:count', handleAnswerCount);
    socket.on('question:reveal', handleQuestionReveal);
    socket.on('game:finished', handleGameFinished);
    socket.on('app:error', handleAppError);

    return () => {
      socket.off('host:state', handleHostState);
      socket.off('lobby:update', handleLobbyUpdate);
      socket.off('question:show', handleQuestionShow);
      socket.off('answer:count', handleAnswerCount);
      socket.off('question:reveal', handleQuestionReveal);
      socket.off('game:finished', handleGameFinished);
      socket.off('app:error', handleAppError);
    };
  }, [socket, connected, pin]);

  function handleStartGame() {
    socket.emit('host:start', { pin });
  }

  function handleNextQuestion() {
    socket.emit('host:next', { pin });
  }

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      {isReconnecting && <div className="reconnecting-banner">Reconnecting to server...</div>}
      <Toast message={error} onClose={() => setError('')} />

      {/* --- LOBBY SCREEN (Big Screen) --- */}
      {gameState === 'lobby' && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div className="pin-hero">
            <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Join at <strong>{window.location.origin}</strong> with PIN:
            </p>
            <div className="pin-display">{pin}</div>
          </div>

          <div style={{ margin: '2rem 0' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              Players Joined ({players.length})
            </h2>

            {players.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Waiting for players to join with their phones...
              </p>
            ) : (
              <div className="lobby-roster">
                {players.map((p, idx) => (
                  <div key={idx} className={`player-pill ${!p.connected ? 'disconnected' : ''}`}>
                    <span>👤</span> {p.nickname}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleStartGame}
            className="btn btn-primary"
            disabled={players.length === 0}
            style={{ fontSize: '1.4rem', padding: '1.1rem 3rem', borderRadius: 'var(--radius-lg)' }}
          >
            Start Quiz ({players.length} {players.length === 1 ? 'Player' : 'Players'})
          </button>
        </div>
      )}

      {/* --- QUESTION SCREEN (Big Screen) --- */}
      {gameState === 'question' && currentQuestion && (
        <div style={{ padding: '1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38bdf8' }}>
              Question {currentQuestion.index + 1} of {currentQuestion.total}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, background: 'rgba(255,255,255,0.08)', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)' }}>
              Answers: {answeredCount} / {totalConnected || players.length}
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--bg-card-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '2.5rem 2rem',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              marginBottom: '1.5rem',
            }}
          >
            <h2 style={{ fontSize: '2rem', lineHeight: 1.3 }}>{currentQuestion.text}</h2>
          </div>

          <CountdownBar percentage={percentage} remainingSeconds={remainingSeconds} />

          <div className="answer-grid">
            {currentQuestion.options.map((opt, idx) => {
              const shapes = ['▲', '◆', '●', '■'];
              const colors = ['red', 'blue', 'yellow', 'green'];
              return (
                <div
                  key={idx}
                  className={`answer-btn ${colors[idx]}`}
                  style={{ cursor: 'default' }}
                >
                  <span className="shape-badge">{shapes[idx]}</span>
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- REVEAL SCREEN (Big Screen) --- */}
      {gameState === 'reveal' && revealData && (
        <div style={{ padding: '1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.6rem' }}>Results Breakdown</h2>
            <button
              onClick={handleNextQuestion}
              className="btn btn-primary"
              style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}
            >
              Next Question →
            </button>
          </div>

          {currentQuestion && (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#4ade80', marginBottom: '0.4rem' }}>
                ✓ Correct Answer: {currentQuestion.options[revealData.correctIndex]}
              </div>
              <p style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>
                {revealData.explanation}
              </p>
            </div>
          )}

          {/* Answer Distribution Bars */}
          <ResultsChart
            optionCounts={revealData.optionCounts}
            options={currentQuestion?.options || []}
            correctIndex={revealData.correctIndex}
          />

          {/* Top 5 Leaderboard */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>Top 5 Leaderboard</h3>
            <Leaderboard players={revealData.leaderboardTop5} max={5} />
          </div>
        </div>
      )}

      {/* --- FINISHED SCREEN (Big Screen) --- */}
      {gameState === 'finished' && (
        <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
          <h1 style={{ fontSize: '2.8rem', marginBottom: '0.5rem', color: '#facc15' }}>
            🏆 Game Finished!
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem' }}>
            Here are the final standings for this quiz battle:
          </p>

          <div style={{ maxWidth: '600px', margin: '0 auto 2.5rem auto' }}>
            <Leaderboard players={finalLeaderboard} max={10} />
          </div>

          <button
            onClick={() => navigate('/host')}
            className="btn btn-secondary"
            style={{ fontSize: '1.1rem', padding: '0.8rem 2rem' }}
          >
            ← Return to Host Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
