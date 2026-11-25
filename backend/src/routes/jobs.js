import { Router } from 'express';
import { config } from '../config.js';
import { inTransaction } from '../transactions.js';
import { validateSkillIds } from '../validation.js';

export function createJobsRouter(pool) {
  const router = Router();

  router.get('/', async (_request, response) => {
    // Aggregate the many-to-many skill rows so each job is one response object.
    // FILTER and COALESCE make jobs with no linked skills return an empty array.
    const result = await pool.query(`
      SELECT
        j.id,
        j.job_title AS title,
        j.description,
        u.full_name AS company,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'name', s.technology_name,
              'courseUrl', s.affiliate_course_link
            )
            ORDER BY s.id
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS requirements
      FROM jobs j
      JOIN users u ON u.id = j.company_id
      LEFT JOIN job_skills js ON js.job_id = j.id
      LEFT JOIN skills s ON s.id = js.skill_id
      GROUP BY j.id, u.full_name
      ORDER BY j.id DESC
    `);

    response.json(result.rows);
  });

  router.post('/', async (request, response) => {
    // Demo mode binds writes to one configured company; callers cannot impersonate another.
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    const rawDescription = request.body?.description;
    const description = rawDescription == null
      ? null
      : typeof rawDescription === 'string' ? rawDescription.trim() || null : undefined;

    if (!title || title.length > 150) {
      throw Object.assign(new Error('title is required and must be 150 characters or fewer.'), {
        status: 400,
      });
    }

    if (description === undefined) {
      throw Object.assign(new Error('description must be a string or null.'), { status: 400 });
    }

    const skillIds = validateSkillIds(request.body?.requiredSkillIds, { allowEmpty: false });
    const job = await inTransaction(pool, async (client) => {
      const companyResult = await client.query(
        'SELECT full_name FROM users WHERE id = $1 AND role = $2',
        [config.demoCompanyId, 'company'],
      );

      if (companyResult.rows.length === 0) {
        throw Object.assign(new Error('Configured demo company account was not found.'), {
          status: 503,
          apiCode: 'DEMO_COMPANY_UNAVAILABLE',
          expose: true,
        });
      }

      const skillsResult = await client.query(
        `SELECT id, technology_name AS name, affiliate_course_link AS "courseUrl"
         FROM skills
         WHERE id = ANY($1::integer[])
         ORDER BY id`,
        [skillIds],
      );

      if (skillsResult.rows.length !== skillIds.length) {
        throw Object.assign(new Error('One or more requiredSkillIds do not exist.'), {
          status: 400,
        });
      }

      // The job and its join-table rows must succeed or fail together.
      const insertResult = await client.query(
        `INSERT INTO jobs (company_id, job_title, description)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [config.demoCompanyId, title, description],
      );
      const jobId = insertResult.rows[0].id;

      await client.query(
        `INSERT INTO job_skills (job_id, skill_id)
         SELECT $1, requested.skill_id
         FROM unnest($2::integer[]) AS requested(skill_id)`,
        [jobId, skillIds],
      );

      return {
        id: jobId,
        title,
        description,
        company: companyResult.rows[0].full_name,
        requirements: skillsResult.rows,
      };
    });

    response.status(201).json(job);
  });

  return router;
}
