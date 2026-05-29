import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl
});

export async function query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}

export async function transaction<T>(runner: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await runner(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export async function waitForDatabase(maxAttempts = 30, delayMilliseconds = 1000): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Database did not become ready in time');
}