import crypto from 'crypto';
import { getGame } from '../game/gameStore.js';
import {
  sanitizeNickname,
  calculatePoints,
  getConnectedPlayers,
  transitionToReveal,
  getLeaderboard,
} from '../game/gameEngine.js';
import { env } from '../config/env.js';

/**
 * Registers Socket.io event handlers for player interactions.
 */
export function registerPlayerHandlers(io, socket) {
  /**
   * player:join - Handles new player joins and player reconnects.
   */
  socket.on('player:join', async (data) => {
    try {
      const pin = data?.pin?.toString().trim();
      const nickname = data?.nickname;
      const existingPlayerId = data?.playerId;

      if (!pin) {
        return socket.emit('player:error', { message: 'A 6-digit game PIN is required' });
      }

      const game = getGame(pin);
      if (!game) {
        return socket.emit('player:error', { message: 'Game not found. Please check your PIN.' });
      }

      // --- RECONNECT SCENARIO ---
      if (existingPlayerId && game.players.has(existingPlayerId)) {
        const player = game.players.get(existingPlayerId);

        // Update socket association and restore connected status
        player.socketId = socket.id;
        player.connected = true;

        socket.data.pin = pin;
        socket.data.playerId = player.playerId;
        socket.join(pin);

        // Confirm rejoin
        socket.emit('player:joined', {
          playerId: player.playerId,
          nickname: player.nickname,
        });

        // Send full authoritative state for seamless resumption across refreshes
        const fullLeaderboard = getLeaderboard(game);
        const playerRankObj = fullLeaderboard.find((e) => e.playerId === player.playerId);
        const rank = playerRankObj ? playerRankObj.rank : fullLeaderboard.length;

        const playerState = {
          status: game.status,
          pin: game.pin,
          nickname: player.nickname,
          score: player.score,
          hasAnswered: player.currentAnswer !== null,
          chosenOption: player.currentAnswer ? player.currentAnswer.choiceIndex : null,
        };

        if (game.status === 'question') {
          const currentQ = game.questions[game.currentIndex];
          playerState.currentQuestion = {
            index: game.currentIndex,
            total: game.questions.length,
            text: currentQ.text,
            options: currentQ.options,
            timeLimitMs: game.settings.timeLimitSeconds * 1000,
            endsAt: game.questionEndsAt,
            serverNow: Date.now(),
          };
        } else if (game.status === 'reveal') {
          playerState.result = {
            correct: player.currentAnswer ? player.currentAnswer.isCorrect : false,
            points: player.currentAnswer ? player.currentAnswer.points : 0,
            score: player.score,
            rank,
          };
        }

        socket.emit('player:state', playerState);

        // If still in lobby, broadcast updated presence
        if (game.status === 'lobby') {
          const playerList = Array.from(game.players.values()).map((p) => ({
            nickname: p.nickname,
            connected: p.connected,
          }));
          io.to(pin).emit('lobby:update', {
            players: playerList,
            count: playerList.length,
          });
        }

        return;
      }

      // --- NEW PLAYER JOIN SCENARIO ---
      if (game.status !== 'lobby') {
        return socket.emit('player:error', {
          message: 'This game has already started. New players cannot join.',
        });
      }

      if (game.players.size >= env.MAX_PLAYERS) {
        return socket.emit('player:error', {
          message: `This game room is full (max ${env.MAX_PLAYERS} players).`,
        });
      }

      const cleanNickname = sanitizeNickname(nickname);
      if (!cleanNickname || cleanNickname.length < 2 || cleanNickname.length > 16) {
        return socket.emit('player:error', {
          message: 'Nickname must be between 2 and 16 characters.',
        });
      }

      // Check unique nickname (case-insensitive)
      const isDuplicate = Array.from(game.players.values()).some(
        (p) => p.nickname.toLowerCase() === cleanNickname.toLowerCase()
      );
      if (isDuplicate) {
        return socket.emit('player:error', {
          message: 'That nickname is already taken in this game. Choose another.',
        });
      }

      // Generate unique player UUID
      const newPlayerId = crypto.randomUUID();
      const newPlayer = {
        playerId: newPlayerId,
        nickname: cleanNickname,
        socketId: socket.id,
        connected: true,
        score: 0,
        correctCount: 0,
        currentAnswer: null,
      };

      game.players.set(newPlayerId, newPlayer);
      socket.data.pin = pin;
      socket.data.playerId = newPlayerId;
      socket.join(pin);

      socket.emit('player:joined', {
        playerId: newPlayer.playerId,
        nickname: newPlayer.nickname,
      });

      // Notify host and room of updated lobby roster
      const playerList = Array.from(game.players.values()).map((p) => ({
        nickname: p.nickname,
        connected: p.connected,
      }));
      io.to(pin).emit('lobby:update', {
        players: playerList,
        count: playerList.length,
      });
    } catch (error) {
      console.error('[PlayerHandler] Error on player:join:', error.message);
      socket.emit('app:error', { message: error.message || 'Internal server error' });
    }
  });

  /**
   * player:answer - Handles submission of an answer choice.
   */
  socket.on('player:answer', async (data) => {
    try {
      const pin = data?.pin || socket.data.pin;
      const playerId = data?.playerId || socket.data.playerId;
      const questionIndex = data?.questionIndex;
      const choiceIndex = data?.choiceIndex;

      const game = getGame(pin);
      if (!game) return;

      const player = game.players.get(playerId);
      if (!player) return;

      // Fairness validation:
      // 1. Must be in 'question' status
      if (game.status !== 'question') return;

      // 2. Question index must match currently active question
      if (questionIndex !== game.currentIndex) return;

      // 3. Choice must be an integer 0, 1, 2, or 3
      if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 3) return;

      // 4. Ignore second/subsequent answers from the same player
      if (player.currentAnswer !== null) return;

      // 5. Must arrive before question timer expires (+ 300ms grace period for network latency)
      const now = Date.now();
      if (now > game.questionEndsAt + 300) return;

      // Calculate score server-authoritatively
      const currentQ = game.questions[game.currentIndex];
      const isCorrect = choiceIndex === currentQ.correctIndex;
      const elapsedMs = Math.max(0, now - game.questionStartedAt);
      const timeLimitMs = game.settings.timeLimitSeconds * 1000;
      const points = isCorrect ? calculatePoints(elapsedMs, timeLimitMs) : 0;

      player.currentAnswer = {
        choiceIndex,
        isCorrect,
        points,
        answeredAt: now,
      };

      player.score += points;
      if (isCorrect) {
        player.correctCount++;
      }

      // Update answer progress count
      const connected = getConnectedPlayers(game);
      const answeredCount = connected.filter((p) => p.currentAnswer !== null).length;

      io.to(pin).emit('answer:count', {
        answered: answeredCount,
        total: connected.length,
      });

      // If every connected player has submitted an answer, reveal immediately
      if (connected.length > 0 && answeredCount >= connected.length) {
        transitionToReveal(io, game);
      }
    } catch (error) {
      console.error('[PlayerHandler] Error on player:answer:', error.message);
      socket.emit('app:error', { message: error.message || 'Internal server error' });
    }
  });

  /**
   * Handles player socket disconnection:
   * Marks player disconnected without purging their score or progress.
   */
  socket.on('disconnect', () => {
    try {
      const pin = socket.data.pin;
      const playerId = socket.data.playerId;
      if (!pin || !playerId) return;

      const game = getGame(pin);
      if (!game) return;

      const player = game.players.get(playerId);
      if (!player) return;

      // Mark disconnected
      player.connected = false;

      if (game.status === 'lobby') {
        const playerList = Array.from(game.players.values()).map((p) => ({
          nickname: p.nickname,
          connected: p.connected,
        }));
        io.to(pin).emit('lobby:update', {
          players: playerList,
          count: playerList.length,
        });
      } else if (game.status === 'question') {
        // Recalculate answered vs remaining connected players
        const connected = getConnectedPlayers(game);
        const answeredCount = connected.filter((p) => p.currentAnswer !== null).length;
        io.to(pin).emit('answer:count', {
          answered: answeredCount,
          total: connected.length,
        });

        // If remaining connected players have all answered, transition to reveal
        if (connected.length > 0 && answeredCount >= connected.length) {
          transitionToReveal(io, game);
        }
      }
    } catch (err) {
      console.error('[PlayerHandler] Error on disconnect:', err.message);
    }
  });
}
