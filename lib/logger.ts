// lib/logger.ts

export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) {
      console.log(...args);
    }
  },

  warn: console.warn,

  error: console.error,
};
