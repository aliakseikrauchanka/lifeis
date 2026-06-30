import 'dotenv/config';
import { recentLogs } from '../src/lib/logs';

async function main() {
  const logs = await recentLogs();
  for (const l of logs) {
    const runAt = l.runAt instanceof Date ? l.runAt.toISOString() : String(l.runAt);
    console.log(`${runAt} | ${l.status} | trigger=${l.trigger} | stories=${l.storiesCreated} | feeds=${l.feedsFetched} | ${l.durationMs}ms${l.error ? ' | ERROR: ' + l.error : ''}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
