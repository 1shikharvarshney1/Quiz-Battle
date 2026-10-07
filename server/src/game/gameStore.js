/**
 * In-memory store for active live games.
 *
 * Each live game is identified by a unique 6-digit PIN.
 * Active state includes current question timers, player scores, and socket IDs.
 * Final results are persisted to MongoDB when the game finishes.
 */

// Key: pin (String), Value: GameState object
const liveGames = new Map();

/**
 * Generates a unique 6-digit numeric PIN that is not currently in use.
 */
export function generatePin() {
  let pin;
  do {
    // Generate 6-digit number between 100000 and 999999
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (liveGames.has(pin));
  return pin;
}

/**
 * Creates and registers a new GameState in memory.
 */
export function createGame({ gameId, pin, hostUserId, settings, questions, provider }) {
  const gameState = {
    gameId: gameId.toString(),
    pin,
    hostUserId: hostUserId.toString(),
    settings: {
      timeLimitSeconds: settings.timeLimitSeconds,
    },
    questions,
    provider,
    status: 'lobby', // 'lobby' | 'question' | 'reveal' | 'finished'
    currentIndex: -1,
    questionStartedAt: null,
    questionEndsAt: null,
    timer: null,
    cleanupTimer: null,
    players: new Map(), // playerId -> { playerId, nickname, socketId, connected, score, correctCount, currentAnswer }
    hostSocketId: null,
  };

  liveGames.set(pin, gameState);
  return gameState;
}

/**
 * Retrieves a live game by its PIN.
 */
export function getGame(pin) {
  return liveGames.get(pin) || null;
}

/**
 * Schedules memory cleanup 30 minutes after a game has finished.
 */
export function scheduleGameCleanup(pin) {
  const game = liveGames.get(pin);
  if (!game) return;

  if (game.cleanupTimer) {
    clearTimeout(game.cleanupTimer);
  }

  // 30 minutes in milliseconds
  game.cleanupTimer = setTimeout(() => {
    removeGame(pin);
  }, 30 * 60 * 1000);
}

/**
 * Removes a game from memory and clears any active timers.
 */
export function removeGame(pin) {
  const game = liveGames.get(pin);
  if (game) {
    if (game.timer) clearTimeout(game.timer);
    if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
    liveGames.delete(pin);
  }
}

/**
 * Clear all games and timers (used on server shutdown or reset).
 */
export function clearAllGames() {
  for (const [pin, game] of liveGames.entries()) {
    if (game.timer) clearTimeout(game.timer);
    if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
  }
  liveGames.clear();
}
