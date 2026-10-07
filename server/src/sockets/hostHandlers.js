import { getGame } from '../game/gameStore.js';
import { getConnectedPlayers, startQuestion, advanceGame } from '../game/gameEngine.js';
import { Game } from '../models/Game.js';

/**
 * Registers Socket.io event handlers for host interactions.
 */
export function registerHostHandlers(io, socket) {
  /**
   * host:join - Host joins the room for a game they created.
   * Requires authenticated host JWT matching the game's hostUserId.
   */
  socket.on('host:join', async (data) => {
    try {
      const pin = data?.pin;
      if (!pin) {
        return socket.emit('app:error', { message: 'PIN is required' });
      }

      const game = getGame(pin);
      if (!game) {
        return socket.emit('app:error', { message: 'Game not found or has expired' });
      }

      // Verify the authenticated user is indeed the creator of this game
      if (!socket.data.user || socket.data.user.id !== game.hostUserId) {
        return socket.emit('app:error', { message: 'Unauthorized: not the host of this game' });
      }

      // Join the socket room for this game
      socket.join(pin);
      socket.data.pin = pin;
      socket.data.isHost = true;
      game.hostSocketId = socket.id;

      // Prepare comprehensive host state for initial view or reconnect
      const playersList = Array.from(game.players.values()).map((p) => ({
        nickname: p.nickname,
        connected: p.connected,
        score: p.score,
      }));

      const hostState = {
        status: game.status,
        pin: game.pin,
        players: playersList,
      };

      if (game.status === 'question' || game.status === 'reveal') {
        const currentQ = game.questions[game.currentIndex];
        hostState.currentQuestion = {
          index: game.currentIndex,
          total: game.questions.length,
          text: currentQ.text,
          options: currentQ.options,
          ...(game.status === 'reveal'
            ? {
                correctIndex: currentQ.correctIndex,
                explanation: currentQ.explanation,
              }
            : {}),
        };

        if (game.status === 'question') {
          hostState.remainingMs = Math.max(0, game.questionEndsAt - Date.now());
          const connected = getConnectedPlayers(game);
          const answeredCount = connected.filter((p) => p.currentAnswer !== null).length;
          hostState.answeredCount = answeredCount;
          hostState.totalPlayers = connected.length;
        }
      }

      socket.emit('host:state', hostState);
    } catch (error) {
      console.error('[HostHandler] Error on host:join:', error.message);
      socket.emit('app:error', { message: error.message || 'Internal server error' });
    }
  });

  /**
   * host:start - Host starts the game from the lobby.
   */
  socket.on('host:start', async (data) => {
    try {
      const pin = data?.pin;
      const game = getGame(pin);
      if (!game) {
        return socket.emit('app:error', { message: 'Game not found' });
      }

      if (!socket.data.user || socket.data.user.id !== game.hostUserId) {
        return socket.emit('app:error', { message: 'Unauthorized' });
      }

      if (game.status !== 'lobby') {
        return socket.emit('app:error', { message: 'Game is not in lobby' });
      }

      const connectedPlayers = getConnectedPlayers(game);
      if (connectedPlayers.length < 1) {
        return socket.emit('app:error', { message: 'At least 1 player is required to start the game' });
      }

      // Mark game in-progress in MongoDB
      await Game.findByIdAndUpdate(game.gameId, {
        status: 'in_progress',
        startedAt: new Date(),
      });

      // Begin question 0
      startQuestion(io, game, 0);
    } catch (error) {
      console.error('[HostHandler] Error on host:start:', error.message);
      socket.emit('app:error', { message: error.message || 'Internal server error' });
    }
  });

  /**
   * host:next - Host advances to next question or finishes game from reveal.
   */
  socket.on('host:next', async (data) => {
    try {
      const pin = data?.pin;
      const game = getGame(pin);
      if (!game) {
        return socket.emit('app:error', { message: 'Game not found' });
      }

      if (!socket.data.user || socket.data.user.id !== game.hostUserId) {
        return socket.emit('app:error', { message: 'Unauthorized' });
      }

      if (game.status !== 'reveal') {
        return socket.emit('app:error', { message: 'Cannot advance: game is not in reveal state' });
      }

      await advanceGame(io, game);
    } catch (error) {
      console.error('[HostHandler] Error on host:next:', error.message);
      socket.emit('app:error', { message: error.message || 'Internal server error' });
    }
  });

  /**
   * Handles host disconnect without ending the active game session.
   */
  socket.on('disconnect', () => {
    if (socket.data.isHost && socket.data.pin) {
      const game = getGame(socket.data.pin);
      if (game && game.hostSocketId === socket.id) {
        game.hostSocketId = null;
      }
    }
  });
}
