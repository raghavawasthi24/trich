import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/api.ts',
    '!src/worker.ts',
    '!src/types/**',
  ],
  // Workflow code runs inside Temporal's sandboxed V8 isolate, not the
  // Jest-instrumented process, so Istanbul can't collect coverage for it even
  // though tests/workflow exercises every branch (see README "Known Limitations").
  coverageThreshold: {
    global: {
      lines: 60,
    },
    './src/domain/**': {
      lines: 90,
    },
  },
  testTimeout: 30000,
};

export default config;
