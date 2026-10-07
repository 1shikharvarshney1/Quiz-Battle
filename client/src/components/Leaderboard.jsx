import React from 'react';

export function Leaderboard({ players = [], max = 5 }) {
  const displayPlayers = players.slice(0, max);

  return (
    <div className="leaderboard-list">
      {displayPlayers.map((player, idx) => {
        const rank = player.rank || idx + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const trophy = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : `#${rank} `;

        return (
          <div key={player.playerId || player.nickname || idx} className={`leaderboard-item ${rankClass}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 800 }}>{trophy}</span>
              <span>{player.nickname}</span>
            </div>
            <div style={{ fontWeight: 700, color: '#38bdf8' }}>
              {player.score.toLocaleString()} pts
            </div>
          </div>
        );
      })}
    </div>
  );
}
