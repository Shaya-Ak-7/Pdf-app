import type { AppFile, VaultNote } from '../types';
import { buildBacklinks, extractTags, extractWikiLinks, getNoteTitle, makePreview } from './markdown';
import { hydrateTextContent } from './storage';

export type VaultIndex = {
  notes: VaultNote[];
  allTags: string[];
  linkCount: number;
  fileCount: number;
};

export async function buildVaultIndex(files: AppFile[]): Promise<VaultIndex> {
  const markdownFiles = files.filter((file) => file.kind === 'markdown');
  const hydrated = await Promise.all(markdownFiles.map((file) => hydrateTextContent(file)));

  const baseNotes = hydrated.map((file) => {
    const content = file.textContent ?? '';
    return {
      file,
      title: getNoteTitle(file.name),
      links: extractWikiLinks(content),
      tags: extractTags(content),
      preview: makePreview(content),
    };
  });

  const notes = baseNotes.map((note) => ({
    ...note,
    backlinks: buildBacklinks(note.title, baseNotes),
  }));

  const allTags = Array.from(new Set(notes.flatMap((note) => note.tags))).sort((a, b) => a.localeCompare(b));
  const linkCount = notes.reduce((sum, note) => sum + note.links.length, 0);

  return {
    notes,
    allTags,
    linkCount,
    fileCount: files.length,
  };
}

export function filterVaultFiles(files: AppFile[], query: string, notes: VaultNote[] = []): AppFile[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return files;

  const matchingNoteUris = new Set(
    notes
      .filter((note) => {
        return (
          note.title.toLowerCase().includes(needle) ||
          note.preview.toLowerCase().includes(needle) ||
          note.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
          note.links.some((link) => link.toLowerCase().includes(needle))
        );
      })
      .map((note) => note.file.uri)
  );

  return files.filter((file) => file.name.toLowerCase().includes(needle) || matchingNoteUris.has(file.uri));
}
