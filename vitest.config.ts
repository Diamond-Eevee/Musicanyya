import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'architecture',
          include: ['tests/architecture/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'core',
          include: ['tests/core/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'engine',
          include: ['tests/engine/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'files',
          include: ['tests/files/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'ui',
          include: ['tests/ui/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
      {
        test: {
          name: 'library',
          include: ['tests/library/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'verovio',
          include: ['tests/verovio/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30000,
        },
      },
      {
        test: {
          name: 'electron',
          include: ['tests/electron/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
