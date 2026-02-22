// src/commands/utility/notes.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import {
  getUserNotesDir,
  getCategoryDir,
  listNotes,
  readNote,
  writeNote,
  deleteNote,
} from '../../utils/folderUtils.js';

export const data = new SlashCommandBuilder()
  .setName('notes')
  .setDescription('Manage your personal notes (private to you)')

  // ADD / UPDATE
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('Add or update a note')
      .addStringOption(opt =>
        opt.setName('name')
           .setDescription('Note name/title (max 50 chars)')
           .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('content')
           .setDescription('Note content')
           .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('category')
           .setDescription('Category (optional, default: general)')
           .setRequired(false)
      )
  )

  // VIEW / LIST
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View a specific note or list all in a category')
      .addStringOption(opt =>
        opt.setName('category')
           .setDescription('Category (optional, default: general)')
           .setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('name')
           .setDescription('Specific note name to view (optional)')
           .setRequired(false)
      )
  )

  // REMOVE
  .addSubcommand(sub =>
    sub
      .setName('remove')
      .setDescription('Delete a note')
      .addStringOption(opt =>
        opt.setName('name')
           .setDescription('Name of the note to delete')
           .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('category')
           .setDescription('Category (optional, default: general)')
           .setRequired(false)
      )
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

  const userId = interaction.user.id;
  const userDir = await getUserNotesDir(userId);

  const sub = interaction.options.getSubcommand();

  // ADD / UPDATE
  if (sub === 'add') {
    const category = interaction.options.getString('category') || 'general';
    let name = interaction.options.getString('name', true).trim();
    const content = interaction.options.getString('content', true).trim();

    if (name.length > 50) {
      return interaction.editReply({ content: 'Note name too long (max 50 characters).', flags: 64 });
    }
    if (content.length > 2000) {
      return interaction.editReply({ content: 'Note content too long (max 2000 characters).', flags: 64 });
    }

    // Sanitize name (safe filename)
    name = name.replace(/[^a-z0-9-_ ]/gi, '_').trim() || 'untitled';

    const catDir = await getCategoryDir(userDir, category);
    await writeNote(catDir, name, content);

    return interaction.editReply({
      content: `Note **${name}** saved in category **${category}**.`,
      flags: 64,
    });
  }

  // VIEW / LIST
  if (sub === 'view') {
    const category = interaction.options.getString('category') || 'general';
    let name = interaction.options.getString('name')?.toLowerCase().trim();

    const catDir = await getCategoryDir(userDir, category);
    const notes = await listNotes(catDir);

    if (name) {
      // View specific note
      const content = await readNote(catDir, name);
      if (!content) {
        return interaction.editReply({
          content: `Note **${name}** not found in category **${category}**.`,
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${name} (${category})`)
        .setDescription(content.length > 3900 ? content.slice(0, 3900) + '...' : content)
        .setFooter({ text: `Category: ${category} • ${notes.length} notes total` });

      return interaction.editReply({ embeds: [embed], flags: 64 });
    }

    // List all notes in category
    if (notes.length === 0) {
      return interaction.editReply({
        content: `No notes found in category **${category}** yet.`,
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Notes in ${category}`)
      .setDescription(notes.map(n => `• **${n}**`).join('\n'))
      .setFooter({ text: `Total notes in ${category}: ${notes.length}` });

    return interaction.editReply({ embeds: [embed], flags: 64 });
  }

  // REMOVE
  if (sub === 'remove') {
    const category = interaction.options.getString('category') || 'general';
    const name = interaction.options.getString('name', true).trim();

    const catDir = await getCategoryDir(userDir, category);
    const notes = await listNotes(catDir);

    if (!notes.includes(name)) {
      return interaction.editReply({
        content: `Note **${name}** not found in category **${category}**.`,
        flags: 64,
      });
    }

    await deleteNote(catDir, name);

    return interaction.editReply({
      content: `Note **${name}** deleted from category **${category}**.`,
      flags: 64,
    });
  }
}