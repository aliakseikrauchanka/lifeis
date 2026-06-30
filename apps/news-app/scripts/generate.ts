import 'dotenv/config';
import { generateEdition } from '../src/lib/generate';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const res = await generateEdition({ trigger: 'manual', dryRun });
  console.log(JSON.stringify(res, null, 2));
  if (res.status === 'failed') process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
