# ⚡ Quiz Battle — Kahoot-Style Live Multiplayer Quiz

> A real-time, Kahoot-style quiz platform powered by Node.js, Express, Socket.io, React, and Google Gemini AI.

[![Demo Video / GIF Placeholder](https://via.placeholder.com/800x450/1e1e2f/ffffff?text=Quiz+Battle+Demo+Preview)](https://github.com)  
*Live Demo*: [https://quiz-battle-demo.example.com](https://quiz-battle-demo.example.com) *(Demo placeholder)*

---

## 🎯 Overview

**Quiz Battle** is a live multiplayer quiz application where a host creates a game on any custom topic, Google Gemini AI dynamically generates validated multiple-choice questions (or runs in zero-config mock mode), and players join seamlessly from their mobile phones via a 6-digit PIN and nickname. Answers, timers, scoring, and leaderboards are managed in real time with a server-authoritative state machine.

---

## 🏗️ Architecture Diagram

```
 +-------------------------------------------------------------------------+
 |                                CLIENTS                                  |
 |                                                                         |
 |    [ Host Dashboard / Big Screen ]            [ Mobile Players (1..N) ] |
 |          (React + Socket.io)                     (React + Socket.io)    |
 +------------------------+-----------------------------------+------------+
                          |                                   |
                          | HTTP & WebSocket                  | WebSocket
                          v                                   v
 +-------------------------------------------------------------------------+
 |                              EXPRESS & SOCKET.IO                        |
 |                                                                         |
 |  REST Endpoints:                                                        |
 |  - POST /api/auth/register & /login (JWT 7-day)                         |
 |  - POST /api/games (Zod validation + Cooldown rate-limit)               |
 |  - GET  /api/games (Host history & winner records)                      |
 |                                                                         |
 |  WebSocket Server (Authoritative State Machine):                        |
 |  - Handshake: Optional JWT authentication                               |
 |  - Rooms: Partitioned by 6-digit Game PIN                               |
 |  - Fairness: Server-side timestamps, anti-cheat answer locking          |
 +--------------------+-------------------------------+--------------------+
                      |                               |
                      v                               v
 +----------------------------+   +----------------------------------------+
 |   GOOGLE GEMINI FREE TIER  |   |           PERSISTENCE LAYERS           |
 |   (@google/genai SDK)      |   |                                        |
 |                            |   | 1. In-Memory Store (Map<pin, Game>):   |
 | - Primary: gemini-2.5-flash|   |    Active timers, players, scores      |
 | - Fallback: gemini-2.0-flash   | 2. MongoDB (Mongoose 8):               |
 | - Mock Bank: 17 built-in qs|   |    User profiles & finalized games     |
 +----------------------------+   +----------------------------------------+
```

---

## ✨ Key Features

- **🤖 AI-Generated Trivia**: Generate high-quality 4-option trivia on any topic using Google Gemini's `@google/genai` SDK with strict JSON schema validation and retry logic.
- **🛡️ Zero-Config Mock Mode**: Seamlessly works out-of-the-box without an API key using an integrated bank of verified trivia questions.
- **⏱️ Server-Authoritative Engine**: Clients are never trusted for scores or timers. Answers are timestamped and scored on the backend with a 300ms network grace period.
- **📱 Mobile-First Player Experience**: Players tap giant color-coded answer pads on phones while the host displays questions on a projector/monitor.
- **🔄 Fault-Tolerant Reconnect**: If a player refreshes or loses connection mid-question, their score and state are preserved using a persistent UUID.
- **📊 Real-Time Visual Feedback**: CSS distribution bars show answer breakdowns after every question followed by top-5 leaderboard updates.

---

## 📋 Prerequisites

- **Node.js**: v20.0.0 or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`) or MongoDB Atlas URI
- **Google Gemini API Key** *(Optional)*: Free key from [Google AI Studio](https://aistudio.google.com/apikey)

---

## ⚙️ Environment Variables

Located in `server/.env`:

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `5000` | Port for Express & Socket.io server |
| `MONGODB_URI` | **Yes** | `mongodb://127.0.0.1:27017/quiz-battle` | MongoDB connection string |
| `JWT_SECRET` | **Yes** | *(random string)* | Secret for signing host authentication tokens |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin for Vite dev server |
| `GEMINI_API_KEY` | No | *(empty)* | Google AI Studio API key (empty enables Mock Mode) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Primary Gemini model identifier |
| `GEMINI_FALLBACK_MODEL` | No | `gemini-2.0-flash` | Fallback model if primary is busy or unavailable |
| `MAX_PLAYERS` | No | `30` | Max concurrent players per game room |
| `GAME_CREATE_COOLDOWN_SECONDS` | No | `30` | Anti-spam cooldown per host between game creations |

---

## 🚀 Quick Setup & Installation

### 1. Install all dependencies
Run the root install script:
```bash
npm run install:all
```
This automatically installs dependencies across root, `server/`, and `client/`.

### 2. Configure Environment
A default `server/.env` is pre-created with a secure JWT secret and local MongoDB connection.
To test with Google Gemini AI:
1. Obtain a free key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Paste the key into `server/.env`:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
*(If left blank, Quiz Battle will automatically use the built-in question bank).*

### 3. Run the E2E Test Suite
Ensure MongoDB is running, then run:
```bash
npm run test:e2e
```

### 4. Start Development Server
```bash
npm run dev
```
- Client runs on `http://localhost:5173`
- Server runs on `http://localhost:5000`

---

## 🧠 How Gemini AI Integration Works

Quiz Battle uses the modern `@google/genai` library with structured output constraints:
1. **System Instruction**: Enforces JSON response with exact question counts, 4 unique options, one correct answer, and randomized answer indices.
2. **Data-Only Rule**: Prompts instruct the model that user-supplied topics are data, ignoring any prompt injection commands.
3. **Zod Validation**: Returned JSON is validated against strict constraints (length limits, unique options). If invalid, it retries once.
4. **Fallback Mechanism**: If the primary model hits a `429` (quota limit), `503` (overloaded), or `404` (model unavailable), the engine automatically falls back to `GEMINI_FALLBACK_MODEL`.
5. **Model Customization**: If Google updates free-tier model identifiers, you can adjust `GEMINI_MODEL` in `.env` without modifying code.

---

## 🕹️ Game State Machine

```
   [ Create Game ]
          |
          v
    +-----------+
    |   LOBBY   | <--- Players join with 6-digit PIN & unique nickname
    +-----+-----+
          | Host clicks 'Start' (>= 1 player)
          v
    +-----------+
    | QUESTION  | <--- Server sets timer (10-30s). question:show emitted (NO answers leaked).
    +-----+-----+
          | All players answer OR server timer expires
          v
    +-----------+
    |  REVEAL   | <--- Correct answer revealed. Scores computed. Top-5 leaderboard sent.
    +-----+-----+
          | Host clicks 'Next'
          +---------> More questions remaining? ---> [ Back to QUESTION ]
          |
          v All questions finished
    +-----------+
    | FINISHED  | <--- Final podium broadcasted. Results saved to MongoDB.
    +-----------+
```

---

## 🔌 Socket.io Event Protocol

### Host Events
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `host:join` | Host -> Server | `{ pin }` | Authenticates host and requests current game state |
| `host:state` | Server -> Host | `{ status, players, currentQuestion, remainingMs }` | Full authoritative host state |
| `host:start` | Host -> Server | `{ pin }` | Starts game from lobby |
| `host:next` | Host -> Server | `{ pin }` | Advances to next question or finishes game |

### Player Events
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `player:join` | Player -> Server | `{ pin, nickname, playerId? }` | Joins room or reconnects existing player |
| `player:joined`| Server -> Player | `{ playerId, nickname }` | Confirms join and provides persistent UUID |
| `player:state` | Server -> Player | `{ status, score, currentQuestion, result }` | Full restoration payload on refresh |
| `player:error` | Server -> Player | `{ message }` | Join rejection (bad PIN, duplicate name, etc.) |
| `player:answer`| Player -> Server | `{ pin, playerId, questionIndex, choiceIndex }` | Submits choice 0-3 |
| `player:result`| Server -> Player | `{ correct, points, score, rank }` | Individual score & points for question |

### Room Broadcast Events (`pin`)
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `lobby:update` | Server -> Room | `{ players: [{ nickname, connected }], count }` | Live player roster updates |
| `question:show`| Server -> Room | `{ index, total, text, options, timeLimitMs, endsAt, serverNow }` | Displays question without answer |
| `answer:count` | Server -> Room | `{ answered, total }` | Real-time answered counter |
| `question:reveal`| Server -> Room | `{ correctIndex, explanation, optionCounts, leaderboardTop5 }` | Reveal breakdown & top 5 |
| `game:finished`| Server -> Room | `{ leaderboard }` | Final game podium |

---

## 🧮 Scoring Formula

Speed matters! Points scale linearly based on response time:
$$\text{Points} = \text{round}\left(1000 \times \left(1 - \frac{\text{elapsedMs}}{2 \times \text{timeLimitMs}}\right)\right)$$

- **Instant answer (0ms)**: 1,000 points
- **Last moment ($t = \text{timeLimit}$)**: 500 points
- **Incorrect or no answer**: 0 points
- **Grace Period**: 300ms server grace period to account for packet transit delay.

---

## 👥 How to Test with Multiple Players

1. **Local Browser**:
   - Window 1: Host dashboard at `http://localhost:5173/host/login`
   - Window 2: Incognito browser tab at `http://localhost:5173` as Player "Alice"
   - Window 3: Another private window at `http://localhost:5173` as Player "Bob"
2. **Mobile Phones on Local Wi-Fi**:
   - Find your computer's local IP (e.g., `192.168.1.50`).
   - Open `http://192.168.1.50:5173` on your smartphone browser.

---

## ⚠️ Known Limitations & Design Trade-offs

1. **In-Memory Active Games**: Live games and timers run in server RAM for sub-millisecond responsiveness. If the Node.js process restarts mid-game, live sessions are terminated. Final standings are persisted to MongoDB only upon game completion.
2. **Gemini Free-Tier Rate Limits**: Free tier allows 15 RPM. The built-in 30-second host cooldown and automatic fallback to mock mode ensure uninterrupted play.
3. **Public Topic Privacy**: Prompts sent to Gemini free tier may be reviewed by Google to improve products; only use public trivia topics.

---

## 💼 Resume Bullet Points

- *Architected a real-time multiplayer trivia platform (Kahoot clone) supporting 30+ concurrent players per room using Node.js, Express, Socket.io, and React 18.*
- *Implemented a server-authoritative state machine with millisecond-accurate timer synchronization, anti-cheat answer locking, and dynamic speed-based scoring (500-1000 pts).*
- *Integrated Google Gemini AI via the `@google/genai` SDK with Zod schema validation, automated fallback models, and seamless offline mock fallback.*
- *Designed resilient session persistence enabling instant reconnect and state recovery across browser refreshes via client-held UUIDs.*
