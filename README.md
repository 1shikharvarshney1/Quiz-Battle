# Quiz Battle: Real-Time Multiplayer Quiz Game

A live multiplayer quiz game. A host creates a game on any topic, Google Gemini generates the questions (or built-in mock questions are used), and players join from their phones with a PIN and nickname. Timers, scoring and leaderboards are controlled by the server.

**Stack:** React 18 (Vite), Node.js, Express, Socket.io, MongoDB (Mongoose), Zod, Google Gemini.

## Architecture

```
 [ Host Dashboard ]                 [ Players (1..N) ]
   React + Socket.io                  React + Socket.io
          |                                  |
          +----------- HTTP / WebSocket -----+
                           |
              +------------v-------------+
              |   Express + Socket.io    |
              |  Server-run game engine  |
              |  Rooms by 6-digit PIN    |
              +------+------------+------+
                     |            |
        +------------v--+   +-----v----------------+
        | Gemini API    |   | In-memory games (Map)|
        | + mock bank   |   | MongoDB: users,      |
        +---------------+   | finished games       |
                            +----------------------+
```

## Features

- **AI-generated questions**: 4-option trivia on any topic, validated with Zod, with retry and a fallback model
- **Mock mode**: works without an API key using a built-in question bank
- **Server-controlled game**: the server owns timers and scores; the correct answer is never sent before the reveal
- **Phone-friendly player screen**: big colored answer buttons
- **Reconnect**: a player who refreshes mid-question returns with the same score
- **Live feedback**: answer counts, answer breakdown bars and a top-5 leaderboard after each question

## Prerequisites

- Node.js 20+
- MongoDB (local, or a MongoDB Atlas URI)
- Optional: a free Gemini key from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

```bash
git clone https://github.com/1shikharvarshney1/Quiz-Battle.git
cd Quiz-Battle

npm run install:all

cp server/.env.example server/.env
# Edit server/.env: set MONGODB_URI and JWT_SECRET, optionally GEMINI_API_KEY

npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:5000

## Environment Variables

Located in `server/.env`:

| Variable                       | Required | Default                                 | Description                                |
| ------------------------------ | -------- | --------------------------------------- | ------------------------------------------ |
| `PORT`                         | No       | `5000`                                  | Server port                                |
| `MONGODB_URI`                  | **Yes**  | `mongodb://127.0.0.1:27017/quiz-battle` | MongoDB connection string                  |
| `JWT_SECRET`                   | **Yes**  | none                                    | Secret for signing host tokens             |
| `CLIENT_ORIGIN`                | No       | `http://localhost:5173`                 | Allowed CORS origin                        |
| `GEMINI_API_KEY`               | No       | empty (mock mode)                       | Google AI Studio key                       |
| `GEMINI_MODEL`                 | No       | `gemini-3.5-flash`                      | Primary Gemini model                       |
| `GEMINI_FALLBACK_MODEL`        | No       | `gemini-3.1-flash-lite`                 | Used if the primary is busy or unavailable |
| `MAX_PLAYERS`                  | No       | `30`                                    | Max players per game                       |
| `GAME_CREATE_COOLDOWN_SECONDS` | No       | `30`                                    | Cooldown between game creations per host   |

## How the AI Part Works

1. The prompt asks Gemini for strict JSON: exact question count, 4 unique options, one correct answer.
2. The topic is treated as data, so instructions hidden in a topic are ignored.
3. The response is validated with Zod; if invalid, it retries once.
4. On rate limit (429), overload (503) or unknown model (404), the server retries with `GEMINI_FALLBACK_MODEL`.
5. Model names are configurable in `.env`, so no code change is needed if Google renames models.

## Game State Machine

```
[ Create Game ] -> LOBBY -> QUESTION -> REVEAL -> FINISHED
                     ^          |          |
                     |          +<---------+  (Host clicks Next while questions remain)
          players join with PIN
```

- **LOBBY**: players join with the PIN and a unique nickname.
- **QUESTION**: the server starts the timer and sends the question without the answer.
- **REVEAL**: the question ends when all connected players answer or the timer expires; the correct answer, counts and top 5 are shown.
- **FINISHED**: final leaderboard is shown and the result is saved to MongoDB.

## Scoring

Faster correct answers earn more points:

$$\text{Points} = \text{round}\left(1000 \times \left(1 - \frac{\text{elapsedMs}}{2 \times \text{timeLimitMs}}\right)\right)$$

- Instant answer: 1000 points
- Answer at the last moment: 500 points
- Wrong or no answer: 0 points
- A 300 ms server grace period covers network delay

## Socket Events

### Host

| Event        | Direction      | Payload                                             | Description                               |
| ------------ | -------------- | --------------------------------------------------- | ----------------------------------------- |
| `host:join`  | Host to Server | `{ pin }`                                           | Authenticates the host and requests state |
| `host:state` | Server to Host | `{ status, players, currentQuestion, remainingMs }` | Full host state                           |
| `host:start` | Host to Server | `{ pin }`                                           | Start the game                            |
| `host:next`  | Host to Server | `{ pin }`                                           | Next question or finish                   |

### Player

| Event           | Direction        | Payload                                         | Description               |
| --------------- | ---------------- | ----------------------------------------------- | ------------------------- |
| `player:join`   | Player to Server | `{ pin, nickname, playerId? }`                  | Join or reconnect         |
| `player:joined` | Server to Player | `{ playerId, nickname }`                        | Confirms join             |
| `player:state`  | Server to Player | `{ status, score, currentQuestion, result }`    | Restores state on refresh |
| `player:error`  | Server to Player | `{ message }`                                   | Join rejected             |
| `player:answer` | Player to Server | `{ pin, playerId, questionIndex, choiceIndex }` | Submit choice 0-3         |
| `player:result` | Server to Player | `{ correct, points, score, rank }`              | Result for the question   |

### Room broadcasts

| Event             | Payload                                                           | Description                 |
| ----------------- | ----------------------------------------------------------------- | --------------------------- |
| `lobby:update`    | `{ players, count }`                                              | Live player list            |
| `question:show`   | `{ index, total, text, options, timeLimitMs, endsAt, serverNow }` | Question without the answer |
| `answer:count`    | `{ answered, total }`                                             | Answered counter            |
| `question:reveal` | `{ correctIndex, explanation, optionCounts, leaderboardTop5 }`    | Reveal and top 5            |
| `game:finished`   | `{ leaderboard }`                                                 | Final leaderboard           |

## Trying it with Multiple Players

Each browser tab keeps its own session, so one browser is enough:

1. Tab 1: open http://localhost:5173, register as a host and create a game.
2. Tabs 2 and 3: type http://localhost:5173 in new tabs (don't duplicate a tab) and join with the PIN and different nicknames.
3. The host doesn't answer; players do. With two players, the question ends when both have answered.

To play from a phone on the same Wi-Fi, open `http://<your-computer-ip>:5173` (the dev server must listen on your network).

## Known Limitations

- Active games live in server memory. If the server restarts mid-game, that game ends. Finished games are saved to MongoDB.
- The free Gemini tier has rate limits; the host cooldown and fallback model reduce the impact.
- Prompts sent on the free tier may be used by Google, so use public topics only.
