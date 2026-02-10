import { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'node:fs/promises';
import path from 'node:path';

// Optional: register a nice font (download and place in assets/fonts/)
try {
  registerFont('../fonts/NovaSquare-Regular.ttf', { family: 'Nova Square' });
} catch { /* fallback to default font */ }

const CONFIG_FILE = path.join(process.cwd(), '/config/welcome.json');

export async function loadWelcomeConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      enabled: false,
      channelId: null,
      message: 'Welcome {user} to {server}!',
      backgroundUrl: null,
      verifiedRoleId: null,
      selfRoles: [], // [{ id: 'roleid', label: 'Role Name', emoji: '🔥' }]
    };
  }
}

export async function saveWelcomeConfig(config) {
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function generateWelcomeImage(member) {
  const config = await loadWelcomeConfig();
  if (!config.enabled || !config.backgroundUrl) return null;

  const canvas = createCanvas(1200, 600);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = await loadImage(config.backgroundUrl).catch(() => null);
  if (bg) {
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#2f3136';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Avatar circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(150, 300, 120, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  const avatar = await loadImage(member.displayAvatarURL({ extension: 'png', size: 256 }));
  ctx.drawImage(avatar, 30, 180, 240, 240);
  ctx.restore();

  // Text
  ctx.font = 'bold 60px Roboto Bold, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`Welcome, ${member.user.username}!`, 320, 280);

  ctx.font = '40px Roboto Bold, sans-serif';
  ctx.fillStyle = '#b9bbbe';
  ctx.fillText(member.guild.name, 320, 340);

  return new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome.png' });
}

export async function sendWelcomeDM(member) {
  const config = await loadWelcomeConfig();
  if (!config.selfRoles?.length && !config.verifiedRoleId) return;

  try {
    // Don't spam DM if already verified
    if (config.verifiedRoleId && member.roles.cache.has(config.verifiedRoleId)) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Welcome to ${member.guild.name}!`)
      .setDescription(
        'Pick your roles below!\n\n' +
        'After selecting, click **Verify Me** to get access and unlock channels.\n\n' +
        'You can reopen this menu anytime with `/verify` in the server.'
      )
      .setThumbnail(member.guild.iconURL())
      .setFooter({ text: 'This is a one-time DM – use /verify later if needed' });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('self_role_select')
        .setPlaceholder('Select your roles...')
        .setMinValues(0)
        .setMaxValues(config.selfRoles.length)
        .addOptions(
          config.selfRoles.map(role => ({
            label: role.label,
            value: role.id,
            emoji: role.emoji || undefined,
          }))
        )
    );

    const verifyRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('Verify Me')
        .setStyle(ButtonStyle.Success)
    );

    await member.send({
      embeds: [embed],
      components: [row, verifyRow],
    });
  } catch (err) {
    console.log(`Could not DM ${member.user.tag}: ${err.message}`);
  }
}