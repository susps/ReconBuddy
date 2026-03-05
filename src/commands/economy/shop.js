// src/commands/economy/shop.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../../models/User.js';
import ShopItem from '../../models/ShopItem.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('View and purchase items from the shop')
  .addStringOption(opt =>
    opt.setName('item')
      .setDescription('Item to purchase')
      .setRequired(false)
  );

export async function execute(interaction) {
  const itemKey = interaction.options.getString('item');
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Fetch all shop items from DB
  const shopItems = await ShopItem.find({});
  const user = await User.findOne({ userId });
  if (!user) {
    return interaction.reply({ content: 'User not found.', ephemeral: true });
  }

  // Show shop items and user's inventory
  if (!itemKey) {
    // Build inventory display
    let inventoryText = 'None';
    if (user.inventory && user.inventory.length > 0) {
      inventoryText = user.inventory.map(inv => {
        if (typeof inv === 'string') return inv;
        if (inv.key === 'casino_membership') {
          return `Casino Membership (expires <t:${Math.floor(inv.expiresAt/1000)}:R>)`;
        }
        return inv.key;
      }).join('\n');
    }
    const embed = new EmbedBuilder()
      .setTitle('NEXI Shop')
      .setDescription('Purchase items with your NEXI Coins!')
      .addFields(
        ...shopItems.map(item => ({
          name: `${item.name} — ${item.price}${item.priceType === 'daily' ? '/day' : ''} NEXI`,
          value: item.description,
        })),
        { name: 'Your Inventory', value: inventoryText, inline: false }
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Find item in DB
  const item = await ShopItem.findOne({ key: itemKey });
  if (!item) {
    return interaction.reply({ content: 'Item not found.', ephemeral: true });
  }

  // Casino Membership logic: 50,000/day
  if (item.key === 'casino_membership') {
    if (user.balance < 50000) {
      return interaction.reply({ content: 'You need 50,000 NEXI to buy a Casino Membership for a day.', ephemeral: true });
    }
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    let expiresAt = now + oneDay;
    let found = false;
    if (user.inventory && Array.isArray(user.inventory)) {
      for (let i = 0; i < user.inventory.length; i++) {
        if (typeof user.inventory[i] === 'object' && user.inventory[i].key === 'casino_membership') {
          // Extend
          user.inventory[i].expiresAt = Math.max(user.inventory[i].expiresAt, now) + oneDay;
          expiresAt = user.inventory[i].expiresAt;
          found = true;
        }
      }
    }
    if (!found) {
      user.inventory.push({ key: 'casino_membership', expiresAt });
    }
    user.balance -= 50000;
    await user.save();
    return interaction.reply({ content: `✅ Casino Membership purchased! Expires <t:${Math.floor(expiresAt/1000)}:R>.`, ephemeral: true });
  }

  // Generic item purchase
  if (user.balance < item.price) {
    return interaction.reply({ content: `You need ${item.price} NEXI to buy this item.`, ephemeral: true });
  }
  user.balance -= item.price;
  user.inventory.push(item.key);
  await user.save();
  return interaction.reply({ content: `✅ You purchased: ${item.name}!`, ephemeral: true });
}
