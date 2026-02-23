import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { load } from 'cheerio';

export const data = new SlashCommandBuilder()
    .setName('loaded')
    .setDescription('Find best deal on Loaded.com with price, image & link')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Platform')
        .setRequired(true)
        .addChoices(
          { name: 'PC', value: 'pc' },
          { name: 'PlayStation', value: 'playstation' },
          { name: 'Xbox', value: 'xbox' },
          { name: 'Nintendo', value: 'nintendo' }
        ))
    .addStringOption(option =>
      option.setName('gamename')
        .setDescription('Game name (e.g. Elden Ring)')
        .setRequired(true));

export async function execute(interaction) {
    await interaction.deferReply();

    const platform = interaction.options.getString('type');
    const gameNameRaw = interaction.options.getString('gamename').trim();

    // Platform-specific URL suffix patterns (based on Elden Ring example + common key shop slugs)
    const platformMap = {
        pc: { suffix: 'pc-steam', display: 'PC (Steam)' },
        playstation: { suffix: 'ps5', display: 'PlayStation 5' }, // or ps4/ps5 depending on game
        xbox: { suffix: 'xbox-series-x-s', display: 'Xbox Series X|S' },
        nintendo: { suffix: 'nintendo-switch', display: 'Nintendo Switch' }
    };

    const plat = platformMap[platform];
    if (!plat) {
        return interaction.editReply({ content: 'Invalid platform.' });
    }

    // Create slug: lowercase, spaces → -, remove specials, trim
    let slug = gameNameRaw
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    // Special handling for common games
    if (slug.includes('elden-ring')) slug = 'elden-ring';

    const productUrl = `https://www.loaded.com/${slug}-${plat.suffix}`;

    // Fallbacks
    const franchiseUrl = `https://www.loaded.com/franchise/${slug}`;
    const platformUrl = `https://www.loaded.com/${platform}/games`;

    try {
        const response = await axios.get(productUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/2.0; +https://discordapp.com)' }
        });

        const $ = load(response.data);

        // Title
        let title = $('h1').first().text().trim() || gameNameRaw;

        // Price - try multiple common selectors
        let price = 'N/A – check site';
        const priceSelectors = [
            '.price', '.sale-price', '.current-price', '.amount',
            '[class*="price"]', '.deal-price', 'span.price', '.product-price'
        ];
        for (const sel of priceSelectors) {
            const el = $(sel).first();
            if (el.length && el.text().trim()) {
                price = el.text().trim().replace(/\s+/g, ' ');
                break;
            }
        }

        // Optional old price
        let oldPriceText = '';
        const oldPrice = $('.old-price, .was-price, .strikethrough, [class*="original"]').first().text().trim();
        if (oldPrice) oldPriceText = ` (was ${oldPrice})`;

        // Image - prefer og:image for high-res box art
        let imageUrl = $('meta[property="og:image"]').attr('content') ||
                       $('img.product-image, img.game-cover, .gallery img, img[alt*="cover"], img').first().attr('src') ||
                       'https://www.loaded.com/assets/images/placeholder.jpg'; // fallback

        if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = `https://www.loaded.com${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }

        // Direct link is the fetched URL
        const directLink = productUrl;

        const embed = new EmbedBuilder()
            .setColor(0xFF4500)
            .setTitle(`Loaded.com - ${title} (${plat.display})`)
            .setDescription(
                `**Current/Lowest Price:** ${price}${oldPriceText}\n\n` +
                `[View & Buy on Loaded.com](${directLink})\n\n` +
                `Instant digital key delivery. Prices vary by region/edition (e.g. EMEA, Global). Check site for availability & discounts.`
            )
            .setImage(imageUrl)
            .setThumbnail('https://www.loaded.com/favicon.ico')
            .setURL(directLink)
            .setFooter({ text: 'Loaded.com - Discount game keys | Up to 90% off' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error fetching Loaded.com:', error.message);

        const fallbackEmbed = new EmbedBuilder()
            .setColor(0xFF6347)
            .setTitle(`Loaded.com - ${gameNameRaw} (${plat.display})`)
            .setDescription(
                `Could not load specific deal page (possible region variant or temporary issue).\n\n` +
                `• Try direct link: [${productUrl}](${productUrl})\n` +
                `• All editions: [Franchise page](${franchiseUrl})\n` +
                `• Browse platform: [${platformUrl}](${platformUrl})\n\n` +
                `Tip: Some games have regional slugs (e.g. -pc-emea-steam). Search on site if needed.`
            )
            .setURL(productUrl)
            .setFooter({ text: 'Fallback – visit Loaded.com for latest' })
            .setTimestamp();

        await interaction.editReply({ embeds: [fallbackEmbed] });
    }
}