// src/events/error.js
import logger from '../utils/logger.js';

export const name = 'error';
export const once = false;

export function execute(error, client) {
  logger.err(error, 'Client Error');
  // Optional: send to error logging channel / sentry / etc.
}