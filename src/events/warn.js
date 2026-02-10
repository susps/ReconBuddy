// src/events/warn.js
export const name = 'warn';
export const once = false;

export function execute(warning, client) {
  console.warn('[CLIENT WARN]', warning);
}