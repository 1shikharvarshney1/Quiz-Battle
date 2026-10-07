import React from 'react';

export function CountdownBar({ percentage, remainingSeconds }) {
  const isWarning = remainingSeconds <= 5;

  return (
    <div style={{ width: '100%', margin: '0.75rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
        <span>Time Remaining</span>
        <span style={{ fontWeight: 'bold', color: isWarning ? '#ef4444' : '#fff' }}>
          {remainingSeconds}s
        </span>
      </div>
      <div className="countdown-wrapper">
        <div
          className={`countdown-bar ${isWarning ? 'warning' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
