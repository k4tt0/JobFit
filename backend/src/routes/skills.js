import { Router } from 'express';

export function createSkillsRouter(pool) {
  const router = Router();

  router.get('/', async (_request, response) => {
    // Translate database column names into the API fields used by the frontend.
    const result = await pool.query(`
      SELECT
        id,
        technology_name AS name,
        affiliate_course_link AS "courseUrl"
      FROM skills
      ORDER BY id
    `);

    response.json(result.rows);
  });

  return router;
}
