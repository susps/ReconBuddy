import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fetch from 'node-fetch';

// Automation: Helper to always get the latest League patch version
async function getLatestVersion() {
    try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await response.json();
        return versions[0];
    } catch (error) {
        console.error("Version fetch failed", error);
        return '15.1.1'; // Robust fallback
    }
}

export const data = new SlashCommandBuilder()
        .setName('league')
        .setDescription('Complete League of Legends Utility')
        
        // --- SUBCOMMANDS ---
        .addSubcommand(sub => sub.setName('champion').setDescription('Get champion stats')
            .addStringOption(opt => opt.setName('name').setDescription('Champion name')))
        
        .addSubcommand(sub => sub.setName('skin').setDescription('Show champion skins')
            .addStringOption(opt => opt.setName('name').setDescription('Champion name').setRequired(true))
            .addStringOption(opt => opt.setName('skin_name').setDescription('Search specific skin')))
        
        .addSubcommand(sub => sub.setName('ability').setDescription('Ability details')
            .addStringOption(opt => opt.setName('champion').setDescription('Champion name').setRequired(true)))
        
        .addSubcommand(sub => sub.setName('rune').setDescription('Fetch rune details')
            .addStringOption(opt => opt.setName('name').setDescription('Rune name (e.g. Conqueror)')))
        
        .addSubcommand(sub => sub.setName('item').setDescription('Fetch item details')
            .addStringOption(opt => opt.setName('name').setDescription('Item name')))
        
        .addSubcommand(sub => sub.setName('summoner').setDescription('Get summoner rank and level')
            .addStringOption(opt => opt.setName('region').setDescription('e.g. na1, euw1, kr').setRequired(true))
            .addStringOption(opt => opt.setName('name').setDescription('Summoner name').setRequired(true)))
        
        .addSubcommand(sub => sub.setName('rotation').setDescription('Free-to-play champion rotation'))
        
        .addSubcommand(sub => sub.setName('patchnotes').setDescription('View latest patch notes'))
        
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('Top players')
            .addStringOption(opt => opt.setName('queue').setDescription('solo or flex').setRequired(true).addChoices(
                { name: 'Solo/Duo', value: 'ranked-solo-5x5' },
                { name: 'Flex', value: 'ranked-flex-sr' }
            )));

export async function execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        const version = await getLatestVersion();
        const RIOT_KEY = process.env.RIOT_API_KEY;

        // 1. CHAMPION LOGIC
        if (subcommand === 'champion') {
            const name = interaction.options.getString('name');
            const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
            const data = await res.json();
            const champ = data.data[name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()];

            if (!champ) return interaction.editReply("Champion not found.");

            const embed = new EmbedBuilder()
                .setTitle(`${champ.name} - ${champ.title}`)
                .setDescription(champ.blurb)
                .setThumbnail(`http://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.id}.png`)
                .addFields({ name: 'Roles', value: champ.tags.join(', '), inline: true });
            return interaction.editReply({ embeds: [embed] });
        }

        // 2. SKIN LOGIC
        if (subcommand === 'skin') {
            const champName = interaction.options.getString('name');
            const searchSkin = interaction.options.getString('skin_name');
            const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${champName}.json`);
            const data = await res.json();
            const champion = data.data[champName];
            
            const skin = searchSkin 
                ? champion.skins.find(s => s.name.toLowerCase().includes(searchSkin.toLowerCase())) || champion.skins[0]
                : champion.skins[Math.floor(Math.random() * champion.skins.length)];

            const embed = new EmbedBuilder()
                .setTitle(`${champion.name}: ${skin.name}`)
                .setImage(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion.id}_${skin.num}.jpg`);
            return interaction.editReply({ embeds: [embed] });
        }

        // 3. RUNE LOGIC
        if (subcommand === 'rune') {
            const runeName = interaction.options.getString('name');
            const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`);
            const runes = await res.json();

            let found;
            runes.forEach(tree => tree.slots.forEach(slot => {
                const r = slot.runes.find(run => run.name.toLowerCase() === runeName?.toLowerCase());
                if (r) found = r;
            }));

            if (!found) return interaction.editReply("Rune not found.");
            const embed = new EmbedBuilder()
                .setTitle(found.name)
                .setDescription(found.longDesc.replace(/<[^>]*>/g, ''))
                .setThumbnail(`https://ddragon.canisback.com/img/${found.icon}`);
            return interaction.editReply({ embeds: [embed] });
        }

        // 4. SUMMONER LOGIC (RIOT API)
        if (subcommand === 'summoner') {
            const region = interaction.options.getString('region');
            const name = interaction.options.getString('name');

            try {
                const sRes = await fetch(`https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(name)}?api_key=${RIOT_KEY}`);
                const summoner = await sRes.json();
                
                const embed = new EmbedBuilder()
                    .setTitle(`${summoner.name}`)
                    .addFields({ name: 'Level', value: summoner.summonerLevel.toString() })
                    .setThumbnail(`http://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${summoner.profileIconId}.png`);
                return interaction.editReply({ embeds: [embed] });
            } catch (e) { return interaction.editReply("Error fetching summoner. Check API Key/Region."); }
        }

        // 5. ROTATION LOGIC
        if (subcommand === 'rotation') {
            const rotRes = await fetch(`https://euw1.api.riotgames.com/lol/platform/v3/champion-rotations?api_key=${RIOT_KEY}`);
            const rotData = await rotRes.json();
            const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
            const champData = await champRes.json();
            const names = Object.values(champData.data).filter(c => rotData.freeChampionIds.includes(parseInt(c.key))).map(c => c.name);
            return interaction.editReply(`**Free Rotation (Patch ${version}):**\n${names.join(', ')}`);
        }

        // 6. PATCH NOTES
        if (subcommand === 'patchnotes') {
            const response = await fetch('https://ddragon.leagueoflegends.com/cdn/patchnotes.json');
            const patchData = await response.json();
            const latest = patchData.patches[0];
            return interaction.editReply(`**Latest Patch: ${latest.version}**\n${latest.details.slice(0, 500)}...`);
        }
}