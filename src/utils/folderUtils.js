import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_DIR = path.join(process.cwd(), 'data/notes');

/**
 * Get or create user's notes root folder
 * @param {string} userId Discord user ID
 * @returns {Promise<string>} full path to user folder
 */
export async function getUserNotesDir(userId) {
  const dir = path.join(BASE_DIR, `user_${userId}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Get or create category subfolder
 * @param {string} userDir user's notes root
 * @param {string} category category name (defaults to 'general')
 * @returns {Promise<string>} full path to category folder
 */
export async function getCategoryDir(userDir, category = 'general') {
  const safeCategory = category.replace(/[^a-z0-9-_]/gi, '_').toLowerCase() || 'general';
  const dir = path.join(userDir, safeCategory);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * List all notes in a category
 * @param {string} categoryDir path to category folder
 * @returns {Promise<string[]>} list of note filenames (without .txt)
 */
export async function listNotes(categoryDir) {
  const files = await fs.readdir(categoryDir);
  return files
    .filter(f => f.endsWith('.txt'))
    .map(f => f.replace(/\.txt$/, ''));
}

/**
 * Read note content
 * @param {string} categoryDir
 * @param {string} noteName
 * @returns {Promise<string>} content or empty string if not found
 */
export async function readNote(categoryDir, noteName) {
  const file = path.join(categoryDir, `${noteName}.txt`);
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Write or overwrite note
 * @param {string} categoryDir
 * @param {string} noteName
 * @param {string} content
 */
export async function writeNote(categoryDir, noteName, content) {
  const file = path.join(categoryDir, `${noteName}.txt`);
  await fs.writeFile(file, content.trim(), 'utf-8');
}

/**
 * Delete note
 * @param {string} categoryDir
 * @param {string} noteName
 */
export async function deleteNote(categoryDir, noteName) {
  const file = path.join(categoryDir, `${noteName}.txt`);
  await fs.unlink(file).catch(() => {});
}