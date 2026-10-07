import { Game } from '../models/Game.js';
import { scheduleGameCleanup } from './gameStore.js';

/**
 * Calculates score for a correct answer based on speed.
 *
 * Scoring formula:
 * - Instant answer (0ms elapsed): 1000 points
 * - Last-moment answer (elapsed == timeLimit): 500 points
 * - Linear decay between 1000 and 500.
 *
 * @param {number} elapsedMs Time from question start to answer arrival
 * @param {number} timeLimitMs Total question duration
 * @returns {number} Points earned (500 to 1000)
 */
export function calculatePoints(elapsedMs, timeLimitMs) {
  const ratio = Math.min(1, Math.max(0, elapsedMs / timeLimitMs));
  return Math.round(1000 * (1 - ratio / 2));
}

/**
 * Strips HTML angle brackets and trims whitespace.
 */
export function sanitizeNickname(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/[<>]/g, '').trim();
}

/**
 * Returns the number of players currently marked as connected.
 */
export function getConnectedPlayers(game) {
  return Array.from(game.players.values()).filter((p) => p.connected);
}

/**
 * Generates leaderboard sorted by score descending.
 */
export function getLeaderboard(game) {
  const sorted = Array.from(game.players.values()).sort((a, b) => b.score - a.score);
  return sorted.map((p, idx) => ({
    rank: idx + 1,
    playerId: p.playerId,
    nickname: p.nickname,
    score: p.score,
    correctCount: p.correctCount,
  }));
}

/**
 * Starts a specific question index and sets up the authoritative timer.
 */
export function startQuestion(io, game, index) {
  game.currentIndex = index;
  game.status = 'question';

  // Reset answer states for all players
  for (const player of game.players.values()) {
    player.currentAnswer = null;
  }

  const currentQ = game.questions[game.currentIndex];
  game.questionStartedAt = Date.now();
  const timeLimitMs = game.settings.timeLimitSeconds * 1000;
  game.questionEndsAt = game.questionStartedAt + timeLimitMs;

  // Clear any existing timer
  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }

  // Authoritative server timer: triggers reveal automatically when time expires
  game.timer = setTimeout(() => {
    transitionToReveal(io, game);
  }, timeLimitMs);

  // Broadcast question payload to all participants in room.
  // Note: NEVER include correctIndex or explanation here!
  io.to(game.pin).emit('question:show', {
    index: game.currentIndex,
    total: game.questions.length,
    text: currentQ.text,
    options: currentQ.options,
    timeLimitMs,
    endsAt: game.questionEndsAt,
    serverNow: Date.now(),
  });

  // Emit initial 0-answered count
  const connectedPlayers = getConnectedPlayers(game);
  io.to(game.pin).emit('answer:count', {
    answered: 0,
    total: connectedPlayers.length,
  });
}

/**
 * Transitions the game from 'question' to 'reveal' state exactly once.
 * Calculates option distribution, updates leaderboard, and notifies participants.
 */
export function transitionToReveal(io, game) {
  // Ensure idempotent execution (e.g. if all players answered right as timer fired)
  if (game.status !== 'question') return;

  game.status = 'reveal';
  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }

  const currentQ = game.questions[game.currentIndex];

  // Count how many players selected each of the 4 options
  const optionCounts = [0, 0, 0, 0];
  for (const player of game.players.values()) {
    if (player.currentAnswer !== null && Number.isInteger(player.currentAnswer.choiceIndex)) {
      const idx = player.currentAnswer.choiceIndex;
      if (idx >= 0 && idx < 4) {
        optionCounts[idx]++;
      }
    }
  }

  const fullLeaderboard = getLeaderboard(game);
  const leaderboardTop5 = fullLeaderboard.slice(0, 5).map(({ rank, nickname, score }) => ({
    rank,
    nickname,
    score,
  }));

  // Broadcast reveal data to room (pin)
  io.to(game.pin).emit('question:reveal', {
    correctIndex: currentQ.correctIndex,
    explanation: currentQ.explanation,
    optionCounts,
    leaderboardTop5,
  });

  // Emit individualized results to each player socket
  for (const player of game.players.values()) {
    if (player.socketId) {
      const playerRankObj = fullLeaderboard.find((entry) => entry.playerId === player.playerId);
      const rank = playerRankObj ? playerRankObj.rank : fullLeaderboard.length;

      io.to(player.socketId).emit('player:result', {
        correct: player.currentAnswer ? player.currentAnswer.isCorrect : false,
        points: player.currentAnswer ? player.currentAnswer.points : 0,
        score: player.score,
        rank,
      });
    }
  }
}

/**
 * Advances the game when the host clicks Next:
 * Either begins the next question or finishes the game if all questions are completed.
 */
export async function advanceGame(io, game) {
  if (game.status !== 'reveal') return;

  const nextIndex = game.currentIndex + 1;
  if (nextIndex < game.questions.length) {
    startQuestion(io, game, nextIndex);
  } else {
    await finishGame(io, game);
  }
}

/**
 * Concludes the game, broadcasts the final leaderboard,
 * persists the results to MongoDB, and schedules memory cleanup.
 */
export async function finishGame(io, game) {
  game.status = 'finished';
  game.finishedAt = new Date();

  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }

  const leaderboard = getLeaderboard(game);

  // Broadcast final results to everyone in room
  io.to(game.pin).emit('game:finished', {
    leaderboard,
  });

  // Persist finalized game state to MongoDB
  try {
    const playersToSave = Array.from(game.players.values()).map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      score: p.score,
      correctCount: p.correctCount,
    }));

    await Game.findByIdAndUpdate(game.gameId, {
      status: 'finished',
      finishedAt: game.finishedAt,
      players: playersToSave,
    });
    console.log(`[GameEngine] Persisted finished game ${game.pin} to database`);
  } catch (err) {
    console.error(`[GameEngine] Error saving finished game ${game.pin}:`, err.message);
  }

  // Schedule memory cleanup 30 minutes from now
  scheduleGameCleanup(game.pin);
}
