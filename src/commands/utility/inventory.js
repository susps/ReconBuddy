// src/commands/utility/inventory.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../../models/User.js';
import ShopItem from '../../models/ShopItem.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your purchased items from the shop');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const user = await User.findOne({ userId: interaction.user.id });
  if (!user || !user.inventory || user.inventory.length === 0) {
    return interaction.editReply({ content: 'You have no items in your inventory.' });
  }

  // Fetch all shop items for details
  const shopItems = await ShopItem.find({});
  const shopItemMap = Object.fromEntries(shopItems.map(i => [i.key, i]));

  const fields = user.inventory.map(item => {
    if (typeof item === 'string') {
      const shopItem = shopItemMap[item];
      return {
        name: shopItem ? shopItem.name : item,
        value: shopItem ? shopItem.description : 'No details available.',
        inline: false,
      };
    } else if (item.key === 'casino_membership') {
      const shopItem = shopItemMap[item.key];
      return {
        name: `${shopItem ? shopItem.name : 'Casino Membership'} (expires <t:${Math.floor(item.expiresAt/1000)}:R>)`,
        value: shopItem ? shopItem.description : 'No details available.',
        inline: false,
      };
    } else {
      const shopItem = shopItemMap[item.key];
      return {
        name: shopItem ? shopItem.name : item.key,
        value: shopItem ? shopItem.description : 'No details available.',
        inline: false,
      };
    }
  });

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username}'s Inventory`)
    .setDescription('Here are your purchased items:')
    .addFields(fields)
    .setColor('#57F287');

  await interaction.editReply({ embeds: [embed] });
}
