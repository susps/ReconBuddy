// src/commands/utility/help.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Shows a list of commands or details about a specific command')
  .addStringOption(option =>
    option
      .setName('command')
      .setDescription('Name of the command to get details for (optional)')
      .setAutocomplete(true)
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const commandName = interaction.options.getString('command')?.toLowerCase();

  // ─── Show details for a specific command ────────────────────────────────
  if (commandName) {
    const cmd = interaction.client.commands.get(commandName);

    if (!cmd) {
      return interaction.editReply({
        content: `Command **/${commandName}** not found.`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Command: /${cmd.data.name}`)
      .setDescription(cmd.data.description || 'No description available')
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    // Show options/arguments
    if (cmd.data.options?.length > 0) {
      let optionsText = '';
      cmd.data.options.forEach(opt => {
        const required = opt.required ? ' (required)' : '';
        optionsText += `**${opt.name}**${required} — ${opt.description}\n`;
      });
      embed.addFields({ name: 'Options', value: optionsText || 'None', inline: false });
    }

    // Show required permissions (if any)
    if (cmd.data.default_member_permissions) {
      embed.addFields({
        name: 'Required Permissions',
        value: `Administrator` // You can map the bitfield to human-readable names later
      });
    }

    return interaction.editReply({ embeds: [embed] });
  }

  // ─── Show overview of all commands by category ──────────────────────────
  const commandsByCategory = new Map();

  for (const [name, cmd] of interaction.client.commands) {
    // Extract category from file path (e.g. moderation/warn.js → Moderation)
    let category = 'General';
    if (cmd.__filename) {
      const parts = cmd.__filename.split(path.sep);
      const folder = parts[parts.length - 2]; // folder name before file
      category = folder.charAt(0).toUpperCase() + folder.slice(1);
    }

    if (!commandsByCategory.has(category)) {
      commandsByCategory.set(category, []);
    }

    commandsByCategory.get(category).push({
      name,
      description: cmd.data.description || 'No description',
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Bot Commands Overview')
    .setDescription(
      'Here are all available commands. Use `/help <command>` for details or use the dropdown below to filter by category.'
    )
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  commandsByCategory.forEach((cmds, category) => {
    embed.addFields({
      name: `${category} (${cmds.length})`,
      value: cmds.map(c => `\`/${c.name}\` — ${c.description}`).join('\n') || 'None',
      inline: false,
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'command') {
    const choices = [...interaction.client.commands.keys()]
      .filter(name => name.toLowerCase().includes(focused.value.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(
      choices.map(name => ({ name, value: name }))
    );
  }
}