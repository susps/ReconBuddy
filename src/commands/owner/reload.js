// src/commands/owner/reload.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('reload')
  .setDescription('Hot-reload events, commands, and components (owner only)');

export async function execute(interaction) {
  // ─── Owner check ────────────────────────────────────────────────
  const ownerIds = process.env.OWNER_IDS?.split(',') || ['YOUR_ID_HERE'];

  if (!ownerIds.includes(interaction.user.id)) {
    return interaction.reply({
      content: 'This command is restricted to bot owners only.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Reloading...')
    .setTimestamp();

  const startTime = Date.now();

  try {
    // 1. Reload events
    await reloadEvents(interaction.client);
    embed.addFields({ name: 'Events', value: 'Reloaded successfully', inline: true });

    // 2. Reload commands
    await reloadCommands(interaction.client);
    embed.addFields({ name: 'Commands', value: `Reloaded ${interaction.client.commands.size} commands`, inline: true });

    // 3. Reload components
    await reloadComponents(interaction.client);
    embed.addFields({ name: 'Components', value: 'Reloaded successfully', inline: true });

    const timeTaken = Date.now() - startTime;

    embed
      .setColor(0x57f287)
      .setTitle('Reload Complete')
      .setDescription(`Reloaded everything in ${timeTaken}ms`)
      .setFooter({ text: `Triggered by ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Reload failed:', err);

    embed
      .setColor(0xed4245)
      .setTitle('Reload Failed')
      .setDescription('Check console for details.')
      .addFields({ name: 'Error', value: `\`\`\`${err.message}\`\`\``, inline: false });

    await interaction.editReply({ embeds: [embed] });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper reload functions (you can move these to src/utils/reload.js later)
// ─────────────────────────────────────────────────────────────────────────────

async function reloadEvents(client) {
  // Remove all existing listeners first
  client.removeAllListeners();

  const eventsDir = path.join(__dirname, '..', 'events');
  const files = (await fs.readdir(eventsDir)).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

  for (const file of files) {
    const filePath = path.join(eventsDir, file);
    const fileUrl = pathToFileURL(filePath).href;

    // Clear cache so we reload fresh
    delete require.cache[require.resolve(filePath)];

    const event = await import(fileUrl);

    if (!event?.name || typeof event.execute !== 'function') continue;

    const register = event.once ? client.once : client.on;
    register.call(client, event.name, (...args) => event.execute(...args, client));

    console.log(`[RELOAD] Event reloaded: ${event.name}${event.once ? ' (once)' : ''}`);
  }
}

async function reloadCommands(client) {
  client.commands.clear();

  const commandsDir = path.join(__dirname, '..', 'commands');
  const categories = await fs.readdir(commandsDir);

  for (const category of categories) {
    const catPath = path.join(commandsDir, category);
    const stat = await fs.stat(catPath);

    if (!stat.isDirectory()) continue;

    const files = (await fs.readdir(catPath)).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

    for (const file of files) {
      const filePath = path.join(catPath, file);
      const fileUrl = pathToFileURL(filePath).href;

      delete require.cache[require.resolve(filePath)];

      const command = await import(fileUrl);

      if (!command?.data?.name || typeof command.execute !== 'function') continue;

      client.commands.set(command.data.name, command);
      console.log(`[RELOAD] Command reloaded: /${command.data.name} (${category})`);
    }
  }
}

async function reloadComponents(client) {
  // Assuming your componentHandler.js has a function like reloadComponents(client)
  // If not, implement it similarly to the above two functions
  const { loadComponents } = await import('../handlers/componentHandler.js');

  // Clear existing handlers (you may need a clear method)
  // For simplicity, just re-load them
  await loadComponents(client);

  console.log('[RELOAD] Components reloaded');
}