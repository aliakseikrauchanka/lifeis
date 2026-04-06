import esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

const outdir = 'dist';
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: {
    popup: 'popup.ts',
    background: 'background.ts',
  },
  bundle: true,
  outdir,
  format: 'esm',
  target: 'chrome120',
  logLevel: 'info',
});

copyFileSync('popup.html', `${outdir}/popup.html`);
copyFileSync('manifest.json', `${outdir}/manifest.json`);

for (const icon of ['icon16.png', 'icon48.png', 'icon128.png']) {
  try { copyFileSync(icon, `${outdir}/${icon}`); } catch { console.error(`Failed to copy icon: ${icon}`); }
}

console.log('✓ Extension built to ./dist — load it in chrome://extensions');
