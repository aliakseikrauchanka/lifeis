import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4205 },
  // In this Nx monorepo, deps are hoisted to the repo-root node_modules and the
  // Vercel adapter does not trace them into the serverless function. Bundle them
  // into the SSR output instead so the function is self-contained. `sharp` is a
  // native module and must stay external.
  vite: {
    ssr: {
      noExternal: true,
      external: ['sharp'],
    },
  },
});
