import { env } from '@/lib/env';

const LOG_PREFIX = '[Tarsier]';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = env.LOG_LEVEL;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString().slice(11, 19);
  return `${LOG_PREFIX} [${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message), ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message), ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message), ...args);
    }
  },
  error: (message: string, error?: unknown, ...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message), error, ...args);
    }
  },
};
