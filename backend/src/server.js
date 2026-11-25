import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

// The unauthenticated demo API stays on this machine until real authentication is added.
const server = createApp(pool).listen(config.port, '127.0.0.1', () => {
  console.log(`JobFit API listening on port ${config.port}.`);
});

function shutdown() {
  server.close(async (error) => {
    if (error) {
      console.error('Failed to close HTTP server cleanly:', error);
      process.exitCode = 1;
    }

    try {
      await pool.end();
    } catch (poolError) {
      console.error('Failed to close PostgreSQL pool cleanly:', poolError);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
