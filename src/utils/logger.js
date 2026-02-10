async function logToDevChannel(client, message) {
  const channelId = process.env.LOG_CHANNEL_ID; // add to .env
  if (!channelId) return console.log('[DEV LOG]', message);

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await channel.send(message);
    }
  } catch (err) {
    console.error('Failed to log to dev channel:', err);
  }
}