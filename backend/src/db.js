import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.');
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  // Supabase uses TLS; local PostgreSQL can opt out if it has no TLS configured.
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
});

// Idle clients can fail outside a request; report that instead of silently losing the error.
pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});
