import { Router } from 'express';

export function createHealthRouter(pool) {
  const router = Router();

  router.get('/', async (_request, response) => {
    // A trivial query distinguishes a live HTTP process from a usable API/database.
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  });

  return router;
}
