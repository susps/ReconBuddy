// src/events/error.js
export const name = 'error';
export const once = false;

export function execute(error, client) {
  console.error('[CLIENT ERROR]', error);
  // Optional: send to error logging channel / sentry / etc.
}