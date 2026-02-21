import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { load } from 'cheerio';

const BASE_URL = 'https://yarrlist.net';

export const data = new SlashCommandBuilder()
  .setName('yarrlist')
  .setDescription('Arr! Scrape & show pirate site lists from yarrlist.net 🏴‍☠️')
  .addStringOption(option =>
    option
      .setName('section')
      .setDescription('Which category? (leave empty to see all sections)')
      .setRequired(false)
      .addChoices(
        { name: 'Movies/TV Shows', value: 'movies-and-tv-shows' },
        { name: 'Anime', value: 'anime-list' },
        { name: 'Manga', value: 'manga-list' },
        { name: 'Live Sports', value: 'sports-live-streaming' },
        { name: 'Live TV', value: 'live-tv-list' },
        { name: 'Torrents', value: 'torrent-sites-list' },
        { name: 'Games', value: 'games-download-sites' },
        { name: 'Music', value: 'music-download-sites-list' },
        { name: 'eBooks', value: 'ebooks-list' },
        { name: 'Comics', value: 'comics-list' },
        { name: 'VPNs', value: 'list-with-best-vpn-service-2025' },
        { name: 'AdBlockers', value: 'adblockers-list' }
      )
  );

export async function execute(interaction) {
    await interaction.deferReply();

    const section = interaction.options.getString('section');

    try {
      if (!section) {
        // Show all sections (from homepage)
        const { data } = await axios.get(BASE_URL, { timeout: 10000 });
        const $ = load(data);

        const sections = [];
        // Adjust selectors based on actual HTML structure
        // From observation: likely cards or list items with links like <a href="/movies-and-tv-shows">Movies</a>
        $('a[href*="-list"], a[href*="-streaming"], a[href*="vpn-service"], a[href*="adblockers"]').each((i, el) => {
          const href = $(el).attr('href');
          const name = $(el).text().trim() || href.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (href.startsWith('/') && !sections.some(s => s.value === href.slice(1))) {
            sections.push({ name, value: href.slice(1) });
          }
        });

        // Fallback hardcoded if scraping fails to find enough
        if (sections.length < 5) {
          sections.push(
            { name: 'Movies/TV Shows', value: 'movies-and-tv-shows' },
            { name: 'Anime', value: 'anime-list' },
            { name: 'Torrents', value: 'torrent-sites-list' },
            // ... add more as fallback
          );
        }

        const embed = new EmbedBuilder()
          .setColor(0x0f0f4d)
          .setTitle('🏴‍☠️ YarrList - Main Pirate Categories')
          .setDescription('Choose a section with `/yarrlist section:<name>` to see the sites!\n\nAvailable coves:')
          .setThumbnail('https://i.imgur.com/skull-pirate.gif') // replace with real gif if wanted
          .setTimestamp()
          .setFooter({ text: 'Data scraped from yarrlist.net • Use VPN + AdBlock!' });

        sections.forEach(s => {
          embed.addFields({ name: s.name, value: `Use: section:${s.value}`, inline: true });
        });

        embed.addFields({
          name: '⚠️ Avast!',
          value: 'These be unofficial waters — malware, fakes, legal risks. Always use protection. Not endorsed.',
          inline: false
        });

        return interaction.editReply({ embeds: [embed] });
      }

      // Fetch specific section page
      const url = `${BASE_URL}/${section}`;
      const { data } = await axios.get(url, { timeout: 10000 });
      const $ = load(data);

      const sites = [];
      // Common patterns on such lists: often <li> or <div class="site"> with <a> and maybe <span class="desc">
      // Adjust selectors after inspecting real page (dev tools)
      $('a[href^="http"], li a, .site-link, .card a').each((i, el) => {
        const link = $(el).attr('href');
        if (!link || !link.startsWith('http')) return;

        let name = $(el).text().trim();
        if (!name) name = link.split('/').pop() || 'Unnamed Cove';

        // Try to find nearby description (next sibling, or parent text, etc.)
        let desc = '';
        const parent = $(el).parent();
        if (parent.find('small, .desc, .tag, span').length) {
          desc = parent.find('small, .desc, .tag, span').text().trim();
        } else if (parent.next().is('small, p, div.desc')) {
          desc = parent.next().text().trim();
        }

        if (link && name) {
          sites.push({ name, url: link, desc: desc || 'No description' });
        }
      });

      if (sites.length === 0) {
        // Fallback or error
        return interaction.editReply(`No booty found in **${section}** — site layout changed or page empty. Try without section first!`);
      }

      const titleName = section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const embed = new EmbedBuilder()
        .setColor(0x1e3a5f)
        .setTitle(`🏴‍☠️ ${titleName} – YarrList Scraped List`)
        .setDescription(`Freshly pulled from ${url}\nTotal spots: **${sites.length}**`)
        .setURL(url)
        .setTimestamp()
        .setFooter({ text: 'scraped live • domains change often • stay safe' });

      // Discord field limit ~1024 chars → chunk if needed
      let fieldValue = '';
      let fieldCount = 1;

      sites.slice(0, 25).forEach(site => {  // limit to avoid huge embeds
        const line = `• **[${site.name}](${site.url})** ${site.desc ? `(${site.desc})` : ''}\n`;
        if (fieldValue.length + line.length > 950) {
          embed.addFields({ name: `Sites (part ${fieldCount})`, value: fieldValue, inline: false });
          fieldValue = line;
          fieldCount++;
        } else {
          fieldValue += line;
        }
      });
      if (fieldValue) {
        embed.addFields({ name: fieldCount > 1 ? `Sites (part ${fieldCount})` : 'Sites', value: fieldValue, inline: false });
      }

      if (sites.length > 25) {
        embed.addFields({ name: 'More…', value: `+${sites.length - 25} more — check full list at ${url}`, inline: false });
      }

      embed.addFields({
        name: '⚠️ Important Reminder',
        value: 'Use **VPN** • **AdBlock** • Good antivirus • These links can be dangerous or illegal depending on yer location.',
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('YarrList scrape error:', error.message);
      await interaction.editReply(
        'Arrr, trouble on the high seas! Couldnt reach yarrlist.net right now.\n' +
        `Error: ${error.message.includes('timeout') ? 'Timeout' : 'Site down or changed?'}\n` +
        'Try again later or check manually: https://yarrlist.net'
      );
    }
}