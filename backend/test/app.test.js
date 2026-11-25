import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import { createApp } from '../src/app.js';

async function withServer(pool, run) {
  // An ephemeral port avoids conflicts and lets tests exercise the real Express middleware.
  const server = createApp(pool).listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

describe('JobFit API endpoints', () => {
  it('returns skills using the API field names', async () => {
    const skills = [{ id: 1, name: 'HTML', courseUrl: 'https://example.test/html' }];
    const pool = { query: async () => ({ rows: skills }) };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/skills`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), skills);
    });
  });

  it('returns jobs with their company and requirements', async () => {
    const jobs = [{
      id: 1,
      title: 'Junior Developer',
      description: null,
      company: 'Example Co',
      requirements: [{ id: 1, name: 'HTML', courseUrl: null }],
    }];
    const pool = { query: async () => ({ rows: jobs }) };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), jobs);
    });
  });

  it('reports database health-check failures as server errors', async () => {
    const pool = { query: async () => { throw new Error('database unavailable'); } };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error.' },
      });
    });
  });

  it('reports a successful database health check', async () => {
    const pool = { query: async () => ({ rows: [{ '?column?': 1 }] }) };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' });
    });
  });

  it('returns a consistent 404 response for unknown routes', async () => {
    const pool = { query: async () => ({ rows: [] }) };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/not-an-api-route`);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        error: { code: 'NOT_FOUND', message: 'Route not found.' },
      });
    });
  });

  it('creates a job and its skill links in one transaction', async () => {
    const calls = [];
    const client = {
      async query(sql) {
        calls.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
        if (sql.includes('SELECT full_name FROM users')) {
          return { rows: [{ full_name: 'TechCorp SRL' }] };
        }
        if (sql.includes('SELECT id, technology_name')) {
          return {
            rows: [{ id: 2, name: 'CSS', courseUrl: 'https://example.test/css' }],
          };
        }
        if (sql.includes('INSERT INTO jobs')) {
          return { rows: [{ id: 12 }] };
        }
        return { rows: [] };
      },
      release() {},
    };
    const pool = { connect: async () => client };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Junior Developer',
          description: '',
          requiredSkillIds: [2],
        }),
      });

      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), {
        id: 12,
        title: 'Junior Developer',
        description: null,
        company: 'TechCorp SRL',
        requirements: [{ id: 2, name: 'CSS', courseUrl: 'https://example.test/css' }],
      });
    });

    assert.deepEqual(calls, [
      'BEGIN',
      'SELECT full_name',
      'SELECT id,',
      'INSERT INTO',
      'INSERT INTO',
      'COMMIT',
    ]);
  });

  it('rejects invalid required skill IDs without opening a transaction', async () => {
    let connected = false;
    const pool = {
      connect: async () => {
        connected = true;
        throw new Error('Should not connect for invalid input.');
      },
    };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Junior Developer', requiredSkillIds: [] }),
      });

      assert.equal(response.status, 400);
      assert.equal(connected, false);
    });
  });

  it('rolls back job creation when a required skill does not exist', async () => {
    const calls = [];
    const client = {
      async query(sql) {
        calls.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
        if (sql.includes('SELECT full_name FROM users')) {
          return { rows: [{ full_name: 'TechCorp SRL' }] };
        }
        if (sql.includes('SELECT id, technology_name')) {
          return { rows: [] };
        }
        return { rows: [] };
      },
      release() {},
    };
    const pool = { connect: async () => client };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Junior Developer', requiredSkillIds: [999] }),
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: {
          code: 'BAD_REQUEST',
          message: 'One or more requiredSkillIds do not exist.',
        },
      });
    });

    assert.deepEqual(calls, ['BEGIN', 'SELECT full_name', 'SELECT id,', 'ROLLBACK']);
  });

  it('replaces demo student skills transactionally', async () => {
    const calls = [];
    const client = {
      async query(sql) {
        calls.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
        if (sql.includes('SELECT id FROM users')) {
          return { rows: [{ id: 1 }] };
        }
        if (sql.includes('SELECT id, technology_name')) {
          return {
            rows: [{ id: 1, name: 'HTML', courseUrl: 'https://example.test/html' }],
          };
        }
        return { rows: [] };
      },
      release() {},
    };
    const pool = { connect: async () => client };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/demo/student/skills`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillIds: [1] }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), [
        { id: 1, name: 'HTML', courseUrl: 'https://example.test/html' },
      ]);
    });

    assert.deepEqual(calls, [
      'BEGIN',
      'SELECT id',
      'SELECT id,',
      'DELETE FROM',
      'INSERT INTO',
      'COMMIT',
    ]);
  });

  it('allows clearing all skills for the demo student', async () => {
    const calls = [];
    const client = {
      async query(sql) {
        calls.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
        return sql.includes('SELECT id FROM users') ? { rows: [{ id: 1 }] } : { rows: [] };
      },
      release() {},
    };
    const pool = { connect: async () => client };

    await withServer(pool, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/demo/student/skills`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillIds: [] }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), []);
    });

    assert.deepEqual(calls, ['BEGIN', 'SELECT id', 'DELETE FROM', 'COMMIT']);
  });
});
