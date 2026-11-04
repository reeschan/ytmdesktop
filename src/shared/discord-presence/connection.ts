// Delay before the first retry of the Discord connection
export const DISCORD_RETRY_INITIAL_DELAY_MS = 5 * 1000;
// Longest delay between two retries of the Discord connection
export const DISCORD_RETRY_MAX_DELAY_MS = 60 * 1000;
// Time after enabling without a connection until the connection is reported as failed
export const DISCORD_CONNECTION_FAILED_AFTER_MS = 30 * 1000;

// The exponent stays far below the point where a power of two stops being a finite number
const MAX_DOUBLINGS = 52;

/**
 * Returns the delay before the given retry. The first retry waits `initialDelayMs`,
 * each later retry waits twice as long as the one before, and no delay exceeds `maxDelayMs`.
 *
 * @param attempt Number of the retry, starting at 1 (values below 1 are treated as 1)
 * @param initialDelayMs Delay of the first retry
 * @param maxDelayMs Upper bound of the delay
 */
export function retryDelayMs(attempt: number, initialDelayMs: number, maxDelayMs: number): number {
  const doublings = Math.min(Math.max(Math.floor(attempt) - 1, 0), MAX_DOUBLINGS);
  // A non-numeric attempt (NaN) falls back to the first delay
  const exponent = Number.isNaN(doublings) ? 0 : doublings;
  return Math.min(initialDelayMs * 2 ** exponent, maxDelayMs);
}
