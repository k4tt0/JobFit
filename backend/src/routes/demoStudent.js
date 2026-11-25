import { Router } from 'express';
import { config } from '../config.js';
import { inTransaction } from '../transactions.js';
import { validateSkillIds } from '../validation.js';

export function createDemoStudentRouter(pool) {
  const router = Router();

  router.get('/', async (_request, response) => {
    // This is a fixed demo profile, not a user-specific endpoint protected by login.
    const studentResult = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [config.demoStudentId, 'student'],
    );

    if (studentResult.rows.length === 0) {
      throw Object.assign(new Error('Configured demo student account was not found.'), {
        status: 503,
        apiCode: 'DEMO_STUDENT_UNAVAILABLE',
        expose: true,
      });
    }

    const result = await pool.query(
      `SELECT
         s.id,
         s.technology_name AS name,
         s.affiliate_course_link AS "courseUrl"
       FROM student_skills ss
       JOIN skills s ON s.id = ss.skill_id
       WHERE ss.student_id = $1
       ORDER BY s.id`,
      [config.demoStudentId],
    );

    response.json(result.rows);
  });

  router.put('/', async (request, response) => {
    const skillIds = validateSkillIds(request.body?.skillIds, { allowEmpty: true });

    const skills = await inTransaction(pool, async (client) => {
      const studentResult = await client.query(
        'SELECT id FROM users WHERE id = $1 AND role = $2',
        [config.demoStudentId, 'student'],
      );

      if (studentResult.rows.length === 0) {
        throw Object.assign(new Error('Configured demo student account was not found.'), {
          status: 503,
          apiCode: 'DEMO_STUDENT_UNAVAILABLE',
          expose: true,
        });
      }

      const skillsResult = skillIds.length === 0
        ? { rows: [] }
        : await client.query(
          `SELECT id, technology_name AS name, affiliate_course_link AS "courseUrl"
           FROM skills
           WHERE id = ANY($1::integer[])
           ORDER BY id`,
          [skillIds],
        );

      if (skillsResult.rows.length !== skillIds.length) {
        throw Object.assign(new Error('One or more skillIds do not exist.'), { status: 400 });
      }

      await client.query('DELETE FROM student_skills WHERE student_id = $1', [
        config.demoStudentId,
      ]);

      // An empty selection intentionally means "clear this student's skills".
      if (skillIds.length > 0) {
        await client.query(
          `INSERT INTO student_skills (student_id, skill_id)
           SELECT $1, requested.skill_id
           FROM unnest($2::integer[]) AS requested(skill_id)`,
          [config.demoStudentId, skillIds],
        );
      }

      return skillsResult.rows;
    });

    response.json(skills);
  });

  return router;
}
