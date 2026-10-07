import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Fail-fast validation for critical configuration
if (!process.env.MONGODB_URI) {
  throw new Error('FATAL: Missing required environment variable MONGODB_URI');
}

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: Missing required environment variable JWT_SECRET');
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash',
  MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS || '30', 10),
  GAME_CREATE_COOLDOWN_SECONDS: parseInt(process.env.GAME_CREATE_COOLDOWN_SECONDS || '30', 10),
};
