import { z } from 'zod';
import { Game } from '../models/Game.js';
import { env } from '../config/env.js';
import { generateQuestions } from '../services/quizGenerator.js';
import { generatePin, createGame } from '../game/gameStore.js';

// In-memory cooldown tracking per user: userId -> lastCreatedAtTimestamp
const userCreationTimestamps = new Map();

const createGameSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(3, 'Topic must be at least 3 characters')
    .max(80, 'Topic cannot exceed 80 characters'),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    errorMap: () => ({ message: 'Difficulty must be easy, medium, or hard' }),
  }),
  questionCount: z
    .number()
    .int()
    .min(3, 'Question count must be between 3 and 10')
    .max(10, 'Question count must be between 3 and 10'),
  timeLimitSeconds: z
    .number()
    .int()
    .min(10, 'Time limit must be between 10 and 30 seconds')
    .max(30, 'Time limit must be between 10 and 30 seconds'),
});

/**
 * Creates a new quiz game:
 * 1. Enforces host rate-limiting cooldown.
 * 2. Generates questions via Gemini (or fallback mock bank).
 * 3. Persists initial Game record to MongoDB.
 * 4. Registers active GameState in memory store.
 */
export async function createGameHandler(req, res, next) {
  try {
    const userId = req.user._id.toString();

    // Check cooldown
    const lastCreated = userCreationTimestamps.get(userId);
    if (lastCreated) {
      const elapsedMs = Date.now() - lastCreated;
      const cooldownMs = env.GAME_CREATE_COOLDOWN_SECONDS * 1000;
      if (elapsedMs < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - elapsedMs) / 1000);
        return res.status(429).json({
          message: `Please wait ${remainingSec} seconds before creating another game`,
        });
      }
    }

    const { topic, difficulty, questionCount, timeLimitSeconds } = createGameSchema.parse(req.body);

    // Generate questions (Gemini or Mock)
    const { questions, provider } = await generateQuestions({
      topic,
      difficulty,
      count: questionCount,
    });

    const pin = generatePin();

    // Save Game record to MongoDB
    const game = await Game.create({
      pin,
      host: req.user._id,
      topic,
      difficulty,
      timeLimitSeconds,
      provider,
      questions,
      status: 'lobby',
    });

    // Register live game state in server memory
    createGame({
      gameId: game._id,
      pin,
      hostUserId: req.user._id,
      settings: { timeLimitSeconds },
      questions,
      provider,
    });

    // Update cooldown timestamp
    userCreationTimestamps.set(userId, Date.now());

    return res.status(201).json({
      gameId: game._id,
      pin,
      provider,
      questionCount: questions.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves the host's past games, newest first.
 */
export async function listHostGames(req, res, next) {
  try {
    const games = await Game.find({ host: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = games.map((g) => {
      let winnerNickname = null;
      if (g.players && g.players.length > 0) {
        const sorted = [...g.players].sort((a, b) => b.score - a.score);
        winnerNickname = sorted[0].nickname;
      }

      return {
        id: g._id,
        pin: g.pin,
        topic: g.topic,
        difficulty: g.difficulty,
        questionCount: g.questions?.length || 0,
        date: g.createdAt,
        status: g.status,
        playerCount: g.players?.length || 0,
        winner: winnerNickname,
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
}
