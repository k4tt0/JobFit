import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { createHealthRouter } from './routes/health.js';
import { createJobsRouter } from './routes/jobs.js';
import { createSkillsRouter } from './routes/skills.js';
import { createDemoStudentRouter } from './routes/demoStudent.js';

export function createApp(pool) {
  const app = express();

  // Permit the local Vite origin to call this API; override it for another frontend origin.
  app.use(cors({ origin: config.frontendOrigin }));
  // Keep request bodies bounded because this API only accepts small JSON payloads.
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/health', createHealthRouter(pool));
  app.use('/api/skills', createSkillsRouter(pool));
  app.use('/api/jobs', createJobsRouter(pool));
  app.use('/api/demo/student/skills', createDemoStudentRouter(pool));

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
  });

  app.use((error, _request, response, _next) => {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : 500;

    if (status >= 500) {
      console.error('Request failed:', error);
    }

    // Hide unexpected/internal details, but retain deliberately exposed setup errors.
    response.status(status).json({
      error: {
        code: error.apiCode ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
        message: status >= 500 && !error.expose ? 'Internal server error.' : error.message,
      },
    });
  });

  return app;
}
