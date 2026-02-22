// src/commands/admin/setupwelcome.js
import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder 
} from 'discord.js';
import { loadWelcomeConfig, saveWelcomeConfig } from '../../services/welcome.js';

export const data = new SlashCommandBuilder()
  .setName('setupwelcome')
  .setDescription('Configure welcome messages, self-roles & verification (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // View current config
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View the current welcome & verification settings')
  )

  // Toggle enabled/disabled
  .addSubcommand(sub =>
    sub
      .setName('toggle')
      .setDescription('Turn welcome system on/off')
      .addBooleanOption(opt =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable the entire welcome system')
          .setRequired(true)
      )
  )

  // Set welcome channel
  .addSubcommand(sub =>
    sub
      .setName('channel')
      .setDescription('Set the channel where welcome images are sent')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Text-based channel for welcome messages')
          .addChannelTypes(0, 5, 11, 12, 13, 15)
          .setRequired(true)
      )
  )

  // Set background image URL
  .addSubcommand(sub =>
    sub
      .setName('background')
      .setDescription('Set background image for welcome canvas')
      .addStringOption(opt =>
        opt
          .setName('url')
          .setDescription('Direct link to an image (PNG/JPG recommended)')
          .setRequired(true)
      )
  )

  // Set welcome message template
  .addSubcommand(sub =>
    sub
      .setName('message')
      .setDescription('Set the text message sent with welcome image')
      .addStringOption(opt =>
        opt
          .setName('text')
          .setDescription('Supports {user}, {server}, {membercount}')
          .setRequired(true)
      )
  )

  // Set verified role (given after clicking Verify Me)
  .addSubcommand(sub =>
    sub
      .setName('verifiedrole')
      .setDescription('Set role given after verification')
      .addRoleOption(opt =>
        opt
          .setName('role')
          .setDescription('Role to assign after verification')
          .setRequired(true)
      )
  )

  // Add/remove self-assignable role for the menu
  .addSubcommand(sub =>
    sub
      .setName('selfrole')
      .setDescription('Add or remove a role from the self-role selection menu')
      .addRoleOption(opt =>
        opt
          .setName('role')
          .setDescription('The role to add/remove')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Add or remove this role')
          .setRequired(true)
          .addChoices(
            { name: 'Add', value: 'add' },
            { name: 'Remove', value: 'remove' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('label')
          .setDescription('Display name in the menu (optional)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('emoji')
          .setDescription('Emoji shown in the menu (optional)')
          .setRequired(false)
      )
  );

export async function execute(interaction) {
  // Only admins
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'You need Administrator permission to use this command.', flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });

  let config = await loadWelcomeConfig();

  const sub = interaction.options.getSubcommand();

  // ────────────────────────────────────────────────────────────────
  // VIEW current settings
  // ────────────────────────────────────────────────────────────────
  if (sub === 'view') {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Current Welcome Configuration')
      .setDescription(config.enabled ? 'System is **enabled**' : 'System is **disabled**')
      .addFields(
        { name: 'Welcome Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not set', inline: true },
        { name: 'Verified Role', value: config.verifiedRoleId ? `<@&${config.verifiedRoleId}>` : 'Not set', inline: true },
        { name: 'Background Image', value: config.backgroundUrl ? `[View](${config.backgroundUrl})` : 'Not set', inline: false },
        { name: 'Message Template', value: config.message || 'Not set', inline: false },
        {
          name: 'Self-assignable Roles',
          value: config.selfRoles.length
            ? config.selfRoles.map(r => `${r.emoji || ''} **${r.label}** (<@&${r.id}>)`).join('\n')
            : 'None',
          inline: false,
        }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ────────────────────────────────────────────────────────────────
  // TOGGLE enabled/disabled
  // ────────────────────────────────────────────────────────────────
  if (sub === 'toggle') {
    const enabled = interaction.options.getBoolean('enabled', true);
    config.enabled = enabled;

    await saveWelcomeConfig(config);
    return interaction.editReply({
      content: `Welcome system is now **${enabled ? 'enabled' : 'disabled'}**.`,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // CHANNEL
  // ────────────────────────────────────────────────────────────────
  if (sub === 'channel') {
    const channel = interaction.options.getChannel('channel', true);
    config.channelId = channel.id;

    await saveWelcomeConfig(config);
    return interaction.editReply({
      content: `Welcome images will now be sent to ${channel}.`,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // BACKGROUND URL
  // ────────────────────────────────────────────────────────────────
  if (sub === 'background') {
    const url = interaction.options.getString('url', true);
    config.backgroundUrl = url;

    await saveWelcomeConfig(config);
    return interaction.editReply({
      content: `Background image updated.\nPreview: ${url}`,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // MESSAGE TEMPLATE
  // ────────────────────────────────────────────────────────────────
  if (sub === 'message') {
    const text = interaction.options.getString('text', true);
    config.message = text;

    await saveWelcomeConfig(config);
    return interaction.editReply({
      content: 'Welcome message template updated.\nVariables: {user}, {server}, {membercount}',
    });
  }

  // ────────────────────────────────────────────────────────────────
  // VERIFIED ROLE
  // ────────────────────────────────────────────────────────────────
  if (sub === 'verifiedrole') {
    const role = interaction.options.getRole('role', true);
    config.verifiedRoleId = role.id;

    await saveWelcomeConfig(config);
    return interaction.editReply({
      content: `Verified role set to ${role}. New members will receive it after clicking Verify Me.`,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // SELF-ROLE (add/remove)
  // ────────────────────────────────────────────────────────────────
  if (sub === 'selfrole') {
    const role = interaction.options.getRole('role', true);
    const action = interaction.options.getString('action', true);
    const label = interaction.options.getString('label') || role.name;
    const emoji = interaction.options.getString('emoji') || null;

    if (action === 'add') {
      // Prevent duplicates
      config.selfRoles = config.selfRoles.filter(r => r.id !== role.id);
      config.selfRoles.push({ id: role.id, label, emoji });
      await saveWelcomeConfig(config);
      return interaction.editReply({
        content: `Added self-role: **${label}** (${role}) ${emoji || ''}`,
      });
    } else {
      const oldLength = config.selfRoles.length;
      config.selfRoles = config.selfRoles.filter(r => r.id !== role.id);
      if (config.selfRoles.length === oldLength) {
        return interaction.editReply({ content: 'That role was not in the self-role list.' });
      }
      await saveWelcomeConfig(config);
      return interaction.editReply({
        content: `Removed self-role: **${role.name}**`,
      });
    }
  }
}