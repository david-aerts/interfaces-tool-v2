export type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function resolveLevel(): LogLevel {
  const candidate = (process.env.LOG_LEVEL ?? "warn") as LogLevel;
  return candidate in LEVEL_ORDER ? candidate : "warn";
}

export interface Logger {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
}

export function createLogger(): Logger {
  const activeLevel = resolveLevel();

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] <= LEVEL_ORDER[activeLevel];
  }

  return {
    error(message: string) {
      if (shouldLog("error")) console.error(message);
    },
    warn(message: string) {
      if (shouldLog("warn")) console.warn(message);
    },
    info(message: string) {
      if (shouldLog("info")) console.log(message);
    },
    debug(message: string) {
      if (shouldLog("debug")) console.log(message);
    },
  };
}
