// src/commands/utility/help.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import path from 'node:path';

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

const COMMANDS_PER_PAGE = 10;

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

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

    if (cmd.data.options?.length > 0) {
      let optionsText = '';
      cmd.data.options.forEach(opt => {
        const required = opt.required ? ' (required)' : '';
        optionsText += `**${opt.name}**${required} — ${opt.description || 'No description'}\n`;
      });
      embed.addFields({ name: 'Options', value: optionsText.trim() || 'None', inline: false });
    }

    if (cmd.data.default_member_permissions) {
      embed.addFields({
        name: 'Required Permissions',
        value: 'Administrator (or equivalent)',
        inline: true,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  }

  // ─── Show paginated overview ────────────────────────────────────────────
  const commandsByCategory = new Map();

  for (const [name, cmd] of interaction.client.commands) {
    let category = 'General';
    if (cmd.__filename) {
      const parts = cmd.__filename.split(path.sep);
      const folder = parts[parts.length - 2];
      if (folder && folder !== 'utility' && folder !== 'owner') {
        category = folder.charAt(0).toUpperCase() + folder.slice(1);
      }
    }

    if (!commandsByCategory.has(category)) {
      commandsByCategory.set(category, []);
    }

    commandsByCategory.get(category).push({
      name,
      description: cmd.data.description || 'No description',
    });
  }

  const allCommands = [];
  commandsByCategory.forEach(cmds => allCommands.push(...cmds));

  if (allCommands.length === 0) {
    return interaction.editReply({ content: 'No commands loaded yet.', flags: 64 });
  }

  const totalPages = Math.ceil(allCommands.length / COMMANDS_PER_PAGE);
  let currentPage = 0;

  const generateEmbed = (page) => {
    const start = page * COMMANDS_PER_PAGE;
    const end = start + COMMANDS_PER_PAGE;
    const pageCommands = allCommands.slice(start, end);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Bot Commands')
      .setDescription(`Page ${page + 1} of ${totalPages} • ${allCommands.length} commands total`)
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag} • Use /help <command> for details` });

    pageCommands.forEach(cmd => {
      embed.addFields({
        name: `/${cmd.name}`,
        value: cmd.description,
        inline: false,
      });
    });

    return embed;
  };

  const getComponents = (page) => [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('help_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('help_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1)
    ),
  ];

  const message = await interaction.editReply({
    embeds: [generateEmbed(currentPage)],
    components: totalPages > 1 ? getComponents(currentPage) : [],
  });

  // Collector – use button interaction for updates
  const filter = i => i.user.id === interaction.user.id && ['help_prev', 'help_next'].includes(i.customId);
  const collector = message.createMessageComponentCollector({ filter, time: 5 * 60 * 1000 });

  collector.on('collect', async i => {
    // Defer the button interaction
    await i.deferUpdate().catch(() => {});

    if (i.customId === 'help_prev') {
      currentPage = Math.max(0, currentPage - 1);
    } else if (i.customId === 'help_next') {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
    }

    // Update using the BUTTON interaction (this is the key fix)
    await i.update({
      embeds: [generateEmbed(currentPage)],
      components: getComponents(currentPage),
    }).catch(err => {
      console.error('Help page update failed:', err);
    });
  });

  collector.on('end', async () => {
    // Disable buttons when time expires
    try {
      await message.edit({
        components: getComponents(currentPage).map(row => {
          row.components.forEach(btn => btn.setDisabled(true));
          return row;
        }),
      });
    } catch {} // Ignore if message expired
  });
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