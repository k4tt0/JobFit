export async function inTransaction(pool, operation) {
  // Use one checked-out connection for BEGIN, all writes, and COMMIT/ROLLBACK.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Keep the original operation error, while still surfacing rollback failure.
      console.error('Failed to roll back database transaction:', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}
