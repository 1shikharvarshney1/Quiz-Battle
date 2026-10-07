import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: [
        (opts) => Array.isArray(opts) && opts.length === 4,
        'Each question must have exactly 4 options',
      ],
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const playerRecordSchema = new mongoose.Schema(
  {
    playerId: {
      type: String,
      required: true,
    },
    nickname: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: true,
      default: 0,
    },
    correctCount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    pin: {
      type: String,
      required: true,
      index: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['easy', 'medium', 'hard'],
    },
    timeLimitSeconds: {
      type: Number,
      required: true,
      min: 10,
      max: 30,
    },
    provider: {
      type: String,
      required: true,
      enum: ['gemini', 'mock'],
    },
    questions: {
      type: [questionSchema],
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['lobby', 'in_progress', 'finished'],
      default: 'lobby',
    },
    players: {
      type: [playerRecordSchema],
      default: [],
    },
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Game = mongoose.model('Game', gameSchema);
