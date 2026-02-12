// src/commands/moderation/purge.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Bulk delete messages with filters + confirmation')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)

  // Required
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('How many recent messages to scan (2–100)')
      .setMinValue(2)
      .setMaxValue(100)
      .setRequired(true)
  )

  // Filters (all optional)
  .addUserOption(option =>
    option.setName('user').setDescription('Delete only from this user').setRequired(false)
  )
  .addStringOption(option =>
    option.setName('contains').setDescription('Delete messages containing this text').setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('bots').setDescription('Delete only bot messages').setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('links').setDescription('Delete messages with any links/URLs').setRequired(false)
  )

  // Reason (optional, audit log)
  .addStringOption(option =>
    option.setName('reason').setDescription('Reason for purge (audit log)').setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const amount = interaction.options.getInteger('amount', true);
  const targetUser = interaction.options.getUser('user');
  const containsText = interaction.options.getString('contains')?.toLowerCase();
  const onlyBots = interaction.options.getBoolean('bots') ?? false;
  const onlyLinks = interaction.options.getBoolean('links') ?? false;
  const reason = interaction.options.getString('reason') || 'Bulk purge via /purge';

  if (amount < 2 || amount > 100) {
    return interaction.editReply({ content: 'Amount must be 2–100.' });
  }

  // Fetch messages to preview
  let messages;
  try {
    messages = await interaction.channel.messages.fetch({ limit: amount });
  } catch (err) {
    return interaction.editReply({ content: 'Could not fetch messages.', ephemeral: true });
  }

  // Apply filters
  const toDelete = messages.filter(msg => {
    if (msg.pinned) return false; // can't bulk-delete pinned

    if (targetUser && msg.author.id !== targetUser.id) return false;
    if (containsText && !msg.content.toLowerCase().includes(containsText)) return false;
    if (onlyBots && !msg.author.bot) return false;

    // Simple link detection
    if (onlyLinks && !/(https?:\/\/|www\.)/i.test(msg.content)) return false;

    return true;
  });

  const deleteCount = toDelete.size;

  if (deleteCount === 0) {
    return interaction.editReply({ content: 'No messages match the filters.' });
  }

  // Confirmation embed
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle('Confirm Purge')
    .setDescription(`This will **delete ${deleteCount} messages** matching your filters.\n\nContinue?`)
    .addFields(
      { name: 'Filters', value: [
        `Amount: ${amount}`,
        targetUser ? `User: ${targetUser.tag}` : null,
        containsText ? `Contains: "${containsText}"` : null,
        onlyBots ? 'Only bots' : null,
        onlyLinks ? 'Only links' : null,
        reason ? `Reason: ${reason}` : null,
      ].filter(Boolean).join('\n') || 'None', inline: false }
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('purge_confirm_yes')
      .setLabel('Yes - Delete')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('purge_confirm_no')
      .setLabel('No - Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmMsg = await interaction.editReply({
    embeds: [confirmEmbed],
    components: [row],
  });

  // Collector for Yes/No buttons (30 seconds timeout)
  const filter = i => i.user.id === interaction.user.id && ['purge_confirm_yes', 'purge_confirm_no'].includes(i.customId);
  const collector = confirmMsg.createMessageComponentCollector({ filter, time: 30_000, componentType: ComponentType.Button });

  collector.on('collect', async i => {
    await i.deferUpdate();

    if (i.customId === 'purge_confirm_no') {
      return i.editReply({
        content: 'Purge cancelled.',
        embeds: [],
        components: [],
      });
    }

    // User confirmed Yes → delete
    try {
      await interaction.channel.bulkDelete(toDelete, true);

      const successEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Purge Complete')
        .setDescription(`Successfully deleted **${deleteCount}** messages.`)
        .addFields({ name: 'Reason', value: reason, inline: false })
        .setTimestamp();

      await i.editReply({ embeds: [successEmbed], components: [] });
    } catch (err) {
      console.error('Bulk delete failed:', err);
      await i.editReply({
        content: 'Failed to delete messages (some may be >14 days old or missing perms).',
        embeds: [],
        components: [],
      });
    }
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      interaction.editReply({
        content: 'Purge timed out (30 seconds).',
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  });
}