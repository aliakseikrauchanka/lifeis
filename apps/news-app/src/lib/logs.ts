import { desc } from 'drizzle-orm';
import { getDb } from '../db/client';
import { generationLogs, type GenerationLog } from '../db/schema';

export async function recentLogs(db = getDb(), limit = 20): Promise<GenerationLog[]> {
  return db.select().from(generationLogs).orderBy(desc(generationLogs.runAt)).limit(limit);
}
