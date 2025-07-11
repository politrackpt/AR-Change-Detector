// Jest setup file
import { jest } from '@jest/globals';

// Extend Jest timeout for Playwright tests
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Suppress console.log during tests unless NODE_ENV is test-verbose
  if (process.env.NODE_ENV !== 'test-verbose') {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});
