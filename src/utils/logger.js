// src/utils/logger.js
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import discordWebhookTransport from 'pino-discord-webhook';

const LOG_LEVEL = process.env.LOG_LEVEL?.toLowerCase() || 'info';
const DISCORD_WEBHOOK = process.env.DISCORD_LOG_WEBHOOK || null;

// Discord transport (errors only)
const discordTransport = DISCORD_WEBHOOK
  ? discordWebhookTransport({
      webhookUrl: DISCORD_WEBHOOK,
      username: 'NEXI Logs',
      minLevel: 'error',
      format: (log) => ({
        content: `**[${log.levelLabel.toUpperCase()}]** ${log.msg}\n\`\`\`json\n${JSON.stringify(log, null, 2)}\n\`\`\``,
      }),
    })
  : null;

// Pretty console (dev)
const prettyTransport = pinoPretty({
  colorize: true,
  ignore: 'pid,hostname',
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
});

// Rotating file logs
const fileTransport = pino.transport({
  target: 'pino/file',
  options: {
    destination: './logs/bot-%DATE%.log',
    mkdir: true,
    rotationTime: true,
    interval: '1d',
    maxFiles: 14,
  },
});

// Raw Pino logger
const logger = pino(
  {
    level: LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  pino.multistream([
    prettyTransport,
    fileTransport,
    ...(discordTransport ? [discordTransport] : []),
  ])
);

// Nice wrapper with .err() method
export const log = {
  trace: (msg, ...args) => logger.trace(...args, msg),
  debug: (msg, ...args) => logger.debug(...args, msg),
  info: (msg, ...args) => logger.info(...args, msg),
  warn: (msg, ...args) => logger.warn(...args, msg),
  error: (msg, ...args) => logger.error(...args, msg),
  fatal: (msg, ...args) => logger.fatal(...args, msg),

  // Special .err() for errors with stack trace
  err: (err, msg = 'Unexpected error') => logger.error({ err: err.stack || err.toString() }, msg),
};

// Export both
export default log;