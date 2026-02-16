// src/commands/owner/antiraid.js
import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { setRaidMode, isRaidModeActive, getGuildConfig, updateGuildConfig } from '../../services/antiSpam.js';

export const data = new SlashCommandBuilder()
  .setName('antiraid')
  .setDescription('Manage raid mode and anti-spam/raid settings (owner only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // Toggle raid mode (strict mode on/off)
  .addSubcommand(sub =>
    sub
      .setName('toggle')
      .setDescription('Turn raid mode on or off')
      .addBooleanOption(opt =>
        opt
          .setName('enabled')
          .setDescription('true = strict protections ON, false = OFF')
          .setRequired(true)
      )
  )

  // View current settings
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('View current anti-raid and spam settings')
  )

  // Configure join protection
  .addSubcommandGroup(group =>
    group
      .setName('join')
      .setDescription('Configure join rate-limit (anti-raid)')

      .addSubcommand(sub =>
        sub
          .setName('enable')
          .setDescription('Turn join rate limiting on/off')
          .addBooleanOption(opt => opt.setName('value').setDescription('Enable or disable').setRequired(true))
      )
      .addSubcommand(sub =>
        sub
          .setName('max')
          .setDescription('Max joins allowed in time window')
          .addIntegerOption(opt =>
            opt.setName('count')
               .setDescription('Max joins (1–50)')
               .setMinValue(1)
               .setMaxValue(50)
               .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('window')
          .setDescription('Time window for join limit')
          .addIntegerOption(opt =>
            opt.setName('seconds')
               .setDescription('Seconds (10–600)')
               .setMinValue(10)
               .setMaxValue(600)
               .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('action')
          .setDescription('Action when limit exceeded')
          .addStringOption(opt =>
            opt.setName('type')
               .setDescription('What to do')
               .addChoices(
                 { name: 'kick', value: 'kick' },
                 { name: 'ban', value: 'ban' },
                 { name: 'timeout (10 min)', value: 'timeout' }
               )
               .setRequired(true)
          )
      )
  )

  // Configure message spam protection
  .addSubcommandGroup(group =>
    group
      .setName('message')
      .setDescription('Configure per-user message spam protection')

      .addSubcommand(sub =>
        sub
          .setName('enable')
          .setDescription('Turn message rate limiting on/off')
          .addBooleanOption(opt => opt.setName('value').setDescription('Enable or disable').setRequired(true))
      )
      .addSubcommand(sub =>
        sub
          .setName('max')
          .setDescription('Max messages allowed in time window')
          .addIntegerOption(opt =>
            opt.setName('count')
               .setDescription('Max messages (3–50)')
               .setMinValue(3)
               .setMaxValue(50)
               .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('window')
          .setDescription('Time window for message limit')
          .addIntegerOption(opt =>
            opt.setName('seconds')
               .setDescription('Seconds (3–300)')
               .setMinValue(3)
               .setMaxValue(300)
               .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('action')
          .setDescription('Action when limit exceeded')
          .addStringOption(opt =>
            opt.setName('type')
               .setDescription('What to do')
               .addChoices(
                 { name: 'mute (5 min)', value: 'mute' },
                 { name: 'kick', value: 'kick' },
                 { name: 'ban', value: 'ban' }
               )
               .setRequired(true)
          )
      )
  );

export async function execute(interaction) {
  // Owner-only check (adjust to your preferred method)
  const ownerIds = process.env.OWNER_IDS?.split(',')?.map(id => id.trim()) || [];
  if (!ownerIds.includes(interaction.user.id)) {
    return interaction.reply({ content: 'This command is restricted to bot owners only.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guild.id;
  let config = getGuildConfig(guildId);
  const sub = interaction.options.getSubcommand();
  const group = interaction.options.getSubcommandGroup();

  let changed = false;

  // ────────────────────────────────────────────────────────────────
  // /antiraid toggle
  // ────────────────────────────────────────────────────────────────
  if (sub === 'toggle') {
    const enabled = interaction.options.getBoolean('enabled', true);
    await setRaidMode(guildId, enabled);
    changed = true;

    return interaction.editReply({
      embeds: [{
        color: enabled ? 0xff0000 : 0x57f287,
        title: `Raid Mode ${enabled ? 'ENABLED' : 'DISABLED'}`,
        description: enabled
          ? 'Strict anti-raid and anti-spam protections are now active.'
          : 'Normal protections restored.',
        timestamp: new Date(),
      }],
    });
  }

  // ────────────────────────────────────────────────────────────────
  // /antiraid status
  // ────────────────────────────────────────────────────────────────
  if (sub === 'status') {
    const raidActive = isRaidModeActive(guildId);

    const embed = new EmbedBuilder()
      .setColor(raidActive ? 0xff0000 : 0x57f287)
      .setTitle('Anti-Raid / Anti-Spam Status')
      .addFields(
        {
          name: 'Raid Mode',
          value: raidActive ? '**ACTIVE** (strict mode)' : 'Inactive',
          inline: true,
        },
        {
          name: 'Join Protection',
          value: `Enabled: ${config.join.enabled}\nMax: ${config.join.maxJoins} in ${config.join.timeWindow/1000}s\nAction: ${config.join.action}`,
          inline: true,
        },
        {
          name: 'Message Protection',
          value: `Enabled: ${config.message.enabled}\nMax: ${config.message.maxMessages} in ${config.message.timeWindow/1000}s\nAction: ${config.message.action}`,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ────────────────────────────────────────────────────────────────
  // Join group (/antiraid join ...)
  // ────────────────────────────────────────────────────────────────
  if (group === 'join') {
    if (sub === 'enable') {
      config.join.enabled = interaction.options.getBoolean('value', true);
      changed = true;
    }

    if (sub === 'max') {
      config.join.maxJoins = interaction.options.getInteger('count', true);
      changed = true;
    }

    if (sub === 'window') {
      config.join.timeWindow = interaction.options.getInteger('seconds', true) * 1000;
      changed = true;
    }

    if (sub === 'action') {
      config.join.action = interaction.options.getString('type', true);
      changed = true;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Message group (/antiraid message ...)
  // ────────────────────────────────────────────────────────────────
  if (group === 'message') {
    if (sub === 'enable') {
      config.message.enabled = interaction.options.getBoolean('value', true);
      changed = true;
    }

    if (sub === 'max') {
      config.message.maxMessages = interaction.options.getInteger('count', true);
      changed = true;
    }

    if (sub === 'window') {
      config.message.timeWindow = interaction.options.getInteger('seconds', true) * 1000;
      changed = true;
    }

    if (sub === 'action') {
      config.message.action = interaction.options.getString('type', true);
      changed = true;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Save changes if any
  // ────────────────────────────────────────────────────────────────
  if (changed) {
    await updateGuildConfig(guildId, config);
  }

  await interaction.editReply({
    content: changed
      ? 'Anti-raid settings updated for this server.'
      : 'No changes were made.',
  });
}