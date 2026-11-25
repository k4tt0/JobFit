import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Resolve relative to this module so startup works from the repo root or backend folder.
loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const port = Number(process.env.PORT ?? 3000);
// These defaults match the student/company seed IDs in database/jobfit.sql.
const demoStudentId = Number(process.env.DEMO_STUDENT_ID ?? 1);
const demoCompanyId = Number(process.env.DEMO_COMPANY_ID ?? 3);
const databaseSslSetting = process.env.DATABASE_SSL ?? 'true';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

if (!Number.isInteger(demoStudentId) || demoStudentId < 1) {
  throw new Error('DEMO_STUDENT_ID must be a positive integer.');
}

if (!Number.isInteger(demoCompanyId) || demoCompanyId < 1) {
  throw new Error('DEMO_COMPANY_ID must be a positive integer.');
}

if (databaseSslSetting !== 'true' && databaseSslSetting !== 'false') {
  throw new Error('DATABASE_SSL must be either true or false.');
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: databaseSslSetting === 'true',
  demoCompanyId,
  demoStudentId,
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  port,
};
