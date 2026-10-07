import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
import { AnswerButton } from '../components/AnswerButton.jsx';
import { CountdownBar } from '../components/CountdownBar.jsx';
import { Toast } from '../components/Toast.jsx';
import { useCountdown } from '../hooks/useCountdown.js';

export function PlayGame() {
  const { pin } = useParams();
  const { socket, connected, isReconnecting } = useSocket();
  const navigate = useNavigate();

  // Retrieve player session info from sessionStorage
  const [session] = useState(() => {
    const saved = sessionStorage.getItem('player_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [gameState, setGameState] = useState('lobby'); // 'lobby' | 'question' | 'reveal' | 'finished'
  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [chosenOption, setChosenOption] = useState(null);
  const [lastResult, setLastResult] = useState(null); // { correct, points, score, rank }
  const [finalRank, setFinalRank] = useState(null);
  const [error, setError] = useState('');

  // Authoritative countdown hook
  const { percentage, remainingSeconds } = useCountdown(
    currentQuestion?.endsAt || null,
    currentQuestion?.serverNow || null,
    currentQuestion?.timeLimitMs || 20000
  );

  useEffect(() => {
    if (!session || !session.playerId) {
      navigate('/');
      return;
    }

    if (!socket || !connected) return;

    // Join or reconnect to game room
    socket.emit('player:join', {
      pin,
      nickname: session.nickname,
      playerId: session.playerId,
    });

    // Authoritative full state on rejoin / refresh
    function handlePlayerState(data) {
      setGameState(data.status);
      setScore(data.score || 0);
      setHasAnswered(data.hasAnswered || false);
      setChosenOption(data.chosenOption ?? null);

      if (data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
      }
      if (data.result) {
        setLastResult(data.result);
      }
    }

    // New question starts
    function handleQuestionShow(data) {
      setGameState('question');
      setCurrentQuestion(data);
      setHasAnswered(false);
      setChosenOption(null);
      setLastResult(null);
    }

    // Individual score and result for current question
    function handlePlayerResult(data) {
      setGameState('reveal');
      setLastResult(data);
      setScore(data.score);
    }

    // Game finished with final standings
    function handleGameFinished(data) {
      setGameState('finished');
      const leaderboard = data.leaderboard || [];
      const myRecord = leaderboard.find((p) => p.playerId === session.playerId);
      if (myRecord) {
        setFinalRank(myRecord.rank);
        setScore(myRecord.score);
      }
    }

    function handlePlayerError(data) {
      setError(data.message || 'Game error');
    }

    socket.on('player:state', handlePlayerState);
    socket.on('question:show', handleQuestionShow);
    socket.on('player:result', handlePlayerResult);
    socket.on('game:finished', handleGameFinished);
    socket.on('player:error', handlePlayerError);

    return () => {
      socket.off('player:state', handlePlayerState);
      socket.off('question:show', handleQuestionShow);
      socket.off('player:result', handlePlayerResult);
      socket.off('game:finished', handleGameFinished);
      socket.off('player:error', handlePlayerError);
    };
  }, [socket, connected, pin, session, navigate]);

  function handleAnswer(index) {
    if (hasAnswered || gameState !== 'question') return;

    setHasAnswered(true);
    setChosenOption(index);

    socket.emit('player:answer', {
      pin,
      playerId: session.playerId,
      questionIndex: currentQuestion?.index,
      choiceIndex: index,
    });
  }

  if (!session) return null;

  return (
    <div className="container" style={{ maxWidth: '520px', padding: '1rem' }}>
      {isReconnecting && <div className="reconnecting-banner">Reconnecting...</div>}
      <Toast message={error} onClose={() => setError('')} />

      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          background: 'var(--bg-glass)',
          border: '1px solid var(--bg-card-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>👤 {session.nickname}</div>
        <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1.1rem' }}>
          {score.toLocaleString()} pts
        </div>
      </div>

      {/* --- LOBBY WAITING SCREEN --- */}
      {gameState === 'lobby' && (
        <div className="center-card" style={{ textAlign: 'center', margin: '2rem 0' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>You're In!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.5 }}>
            See your name on the host's screen? Get ready to answer fast!
          </p>
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ color: '#818cf8', fontWeight: 600 }}>Waiting for host to start...</span>
          </div>
        </div>
      )}

      {/* --- QUESTION SCREEN --- */}
      {gameState === 'question' && currentQuestion && (
        <div>
          <CountdownBar percentage={percentage} remainingSeconds={remainingSeconds} />

          {/* Question text preview for phone users */}
          <div
            style={{
              padding: '1.25rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--bg-card-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '1.1rem',
            }}
          >
            {currentQuestion.text}
          </div>

          {hasAnswered ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--bg-card-border)',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#38bdf8' }}>
                Answer Locked In!
              </h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Waiting for other players and the timer...
              </p>
            </div>
          ) : (
            <div className="answer-grid">
              {currentQuestion.options.map((opt, idx) => (
                <AnswerButton
                  key={idx}
                  index={idx}
                  text={opt}
                  onClick={handleAnswer}
                  disabled={hasAnswered}
                  selected={chosenOption === idx}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- REVEAL SCREEN --- */}
      {gameState === 'reveal' && (
        <div className="center-card" style={{ textAlign: 'center', margin: '2rem 0' }}>
          {lastResult?.correct ? (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎯</div>
              <h2 style={{ color: '#22c55e', fontSize: '2rem', marginBottom: '0.5rem' }}>
                Correct!
              </h2>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#facc15', marginBottom: '1rem' }}>
                +{lastResult.points} pts
              </div>
            </>
          ) : lastResult ? (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>❌</div>
              <h2 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '0.5rem' }}>
                Incorrect
              </h2>
              <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                +0 pts
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>⏰</div>
              <h2 style={{ color: '#f59e0b', fontSize: '2rem', marginBottom: '0.5rem' }}>
                Time's Up!
              </h2>
            </>
          )}

          <div
            style={{
              padding: '1.25rem',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 'var(--radius-md)',
              margin: '1.5rem 0',
            }}
          >
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Current Standing</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
              Rank #{lastResult?.rank || '-'}
            </div>
            <div style={{ fontSize: '1.1rem', color: '#38bdf8', fontWeight: 700, marginTop: '0.2rem' }}>
              Total: {score.toLocaleString()} pts
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Look up at the main screen for details! Next question starting soon...
          </p>
        </div>
      )}

      {/* --- FINISHED SCREEN --- */}
      {gameState === 'finished' && (
        <div className="center-card" style={{ textAlign: 'center', margin: '2rem 0' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
            {finalRank === 1 ? '👑' : finalRank <= 3 ? '🏆' : '🎮'}
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#facc15' }}>
            Quiz Completed!
          </h2>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Final Rank: #{finalRank || '-'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginBottom: '1.5rem' }}>
            Final Score: {score.toLocaleString()} pts
          </div>

          <button
            onClick={() => {
              sessionStorage.removeItem('player_session');
              navigate('/');
            }}
            className="btn btn-secondary btn-block"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
