import React from 'react';

const SHAPES = ['▲', '◆', '●', '■'];
const COLOR_CLASSES = ['red', 'blue', 'yellow', 'green'];

export function ResultsChart({ optionCounts = [0, 0, 0, 0], options = [], correctIndex }) {
  const totalAnswers = optionCounts.reduce((acc, curr) => acc + curr, 0);

  return (
    <div className="results-chart">
      {optionCounts.map((count, idx) => {
        const percent = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
        const colorClass = COLOR_CLASSES[idx];
        const shape = SHAPES[idx];
        const isCorrect = idx === correctIndex;

        return (
          <div key={idx} className="chart-row">
            <div className="chart-label">
              <span>
                {shape} {options[idx] || `Option ${idx + 1}`}{' '}
                {isCorrect && <strong style={{ color: '#22c55e' }}>✓ Correct</strong>}
              </span>
              <span>
                {count} {count === 1 ? 'player' : 'players'} ({percent}%)
              </span>
            </div>
            <div className="chart-bar-bg">
              <div
                className={`chart-bar-fill ${colorClass}`}
                style={{ width: `${Math.max(percent, count > 0 ? 8 : 0)}%` }}
              >
                {count > 0 && `${count}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
