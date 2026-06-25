import { Pool } from "pg";

let _pool;
export function pool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/belovediamond",
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
    });
  }
  return _pool;
}

export async function query(text, params = []) {
  return pool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (_pool) { await _pool.end(); _pool = undefined; }
}
