// src/commands/owner/eval.js

import { SlashCommandBuilder } from '@discordjs/builders';

export const data = new SlashCommandBuilder()
  .setName('eval')
  .setDescription('Executes JavaScript code (owner only)')
  .addStringOption(option =>
    option
      .setName('code')
      .setDescription('The code to run')
      .setRequired(true)
  )
  .setDMPermission(false);

export async function execute(interaction) {
  // Replace with your Discord user ID(s) or load from .env
  const ownerIds = ['335131536062152705']; // ← add your ID here

  if (!ownerIds.includes(interaction.user.id)) {
    return interaction.reply({
      content: 'This command is restricted to bot owners only.',
      flags: 64,
    });
  }
  
  await interaction.deferReply({ flags: 64 });

  const code = interaction.options.getString('code', true);

  // Basic safety check
  if (code.includes('token') || code.includes('process.env')) {
    return interaction.editReply({ content: 'No token leaking allowed.' });
  }

  let result;
  try {
    // Use dynamic import for 'util' in ESM
    const util = await import('node:util');

    // Execute code safely
    // eslint-disable-next-line no-eval
    result = eval(code);

    // Handle promises
    if (result instanceof Promise) {
      result = await result;
    }

    // Format output
    let output = result;

    if (typeof output !== 'string') {
      output = util.inspect(output, { depth: 2 });
    }

    if (output.length > 1900) {
      output = output.slice(0, 1900) + '... [truncated]';
    }

    await interaction.editReply({
      content: null,
      embeds: [{
        color: 0x5865f2,
        title: 'Eval Result',
        description: `\`\`\`js\n${output}\n\`\`\``,
        fields: [
          {
            name: 'Input',
            value: `\`\`\`js\n${code.slice(0, 1000)}\n\`\`\``,
          },
          {
            name: 'Type',
            value: `\`${typeof result}\``,
            inline: true,
          },
        ],
        timestamp: new Date(),
        footer: { text: `Executed by ${interaction.user.tag}` },
      }],
    });
  } catch (error) {
    await interaction.editReply({
      content: null,
      embeds: [{
        color: 0xed4245,
        title: 'Eval Error',
        description: `\`\`\`js\n${error.stack || error.message}\n\`\`\``,
        timestamp: new Date(),
        footer: { text: `Executed by ${interaction.user.tag}` },
      }],
    });
  }
}