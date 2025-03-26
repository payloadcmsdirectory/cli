import chalk from "chalk";

/**
 * Get the current terminal width, defaulting to 80 if not available
 */
const getTerminalWidth = (): number => {
  return process.stdout.columns || 80;
};

/**
 * Word wrap text to fit within terminal width
 * @param text Text to wrap
 * @param indent Indentation for wrapped lines
 * @param maxWidth Maximum width (defaults to terminal width minus 5)
 */
const wrapText = (text: string, indent = "  ", maxWidth?: number): string => {
  const width = maxWidth || Math.max(40, getTerminalWidth() - 5);
  if (text.length <= width) return text;

  const words = text.split(" ");
  let result = "";
  let line = "";

  for (const word of words) {
    if (line.length + word.length + 1 <= width) {
      line += (line ? " " : "") + word;
    } else {
      result += (result ? "\n" + indent : "") + line;
      line = word;
    }
  }

  if (line) {
    result += (result ? "\n" + indent : "") + line;
  }

  return result;
};

/**
 * Logger levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARN = 3,
  ERROR = 4,
}

/**
 * Current log level - can be set based on verbose flag
 */
let currentLogLevel = LogLevel.INFO;

/**
 * Set the current log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Enable verbose logging
 */
export function enableVerbose(): void {
  currentLogLevel = LogLevel.DEBUG;
}

/**
 * Logger utility for consistent CLI output
 */
export const logger = {
  /**
   * Log a debug message (only visible in verbose mode)
   */
  debug: (message: string): void => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(chalk.gray(`[debug] ${wrapText(message)}`));
    }
  },

  /**
   * Log an info message
   */
  info: (message: string): void => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(chalk.blue(`ℹ ${wrapText(message)}`));
    }
  },

  /**
   * Log a success message
   */
  success: (message: string): void => {
    if (currentLogLevel <= LogLevel.SUCCESS) {
      console.log(chalk.green(`✓ ${wrapText(message)}`));
    }
  },

  /**
   * Log a warning message
   */
  warn: (message: string): void => {
    if (currentLogLevel <= LogLevel.WARN) {
      console.log(chalk.yellow(`⚠ ${wrapText(message)}`));
    }
  },

  /**
   * Log an error message
   */
  error: (message: string): void => {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.log(chalk.red(`✖ ${wrapText(message)}`));
    }
  },
};
