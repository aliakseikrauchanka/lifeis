import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!_db) {
    const sql = postgres(url, { max: 1 });
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export { schema };
