/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import legacy from '@vitejs/plugin-legacy';
// import MillionLint from '@million/lint';

// const wasmPaths = [
// '../../node_modules/onnxruntime-web/dist/ort-wasm.wasm', //
// '../../node_modules/onnxruntime-web/dist/ort-wasm-threaded.wasm', //
// '../../node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm', //
// '../../node_modules/onnxruntime-web/dist/ort-wasm-simd.jsep.wasm', //
// '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
// '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
// '../../node_modules/onnxruntime-web/dist/ort-training-wasm-simd.wasm', // ort-training-wasm-simd-threaded.wasm ?
// '../../node_modules/@ricky0123/vad-web/dist/silero_vad.onnx',
// '../../node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
// '../../node_modules/onnxruntime-web/dist/*.wasm',
// ];

export default defineConfig(
  (async () => {
    const viteStaticCopy = (await import('vite-plugin-static-copy')).viteStaticCopy;
    return {
      root: __dirname,
      build: {
        outDir: '../../dist/apps/entry-app',
        reportCompressedSize: true,
        commonjsOptions: {
          transformMixedEsModules: true,
        },
      },
      // resolve: {
      //   alias: {
      //     'sharp': false,
      //     '@emotion/cache': '@emotion/cache/dist/emotion-cache.browser.cjs.js',
      //   },
      // },
      cacheDir: '../../node_modules/.vite/entry-app',
      server: {
        port: 4200,
        host: 'localhost',
      },

      preview: {
        port: 4300,
        host: 'localhost',
      },

      css: {
        modules: {
          localsConvention: 'camelCaseOnly',
        },
      },

      plugins: [
        /*MillionLint.vite(), */ react(),
        nxViteTsPaths(),
        legacy({
          targets: ['Safari >= 12.1'],
          additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
          modernPolyfills: true,
        }),
        // viteStaticCopy({
        //   targets: wasmPaths.map((path) => ({
        //     src: path,
        //     dest: '/public',
        //   })),
        // }),
      ],

      // Uncomment this if you are using workers.
      // worker: {
      //  plugins: [
      //    viteTsConfigPaths({
      //      root: '../../',
      //    }),
      //  ],
      // },

      test: {
        reporters: ['default'],
        coverage: {
          reportsDirectory: '../../coverage/apps/entry-app',
          provider: 'v8',
        },
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },
    };
  })(),
);
