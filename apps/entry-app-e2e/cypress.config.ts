import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  projectId: '88xx2i',
  e2e: nxE2EPreset(__dirname, {
    bundler: 'vite',
  }),
});
