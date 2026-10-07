import { Router } from 'express';
import { createGameHandler, listHostGames } from '../controllers/game.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, createGameHandler);
router.get('/', requireAuth, listHostGames);

export default router;
