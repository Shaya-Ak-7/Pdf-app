export function extractWikiLinks(markdown: string): string[] {
  const links = new Set<string>();
  const regex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown))) {
    const title = match[1]?.trim();
    if (title) links.add(title);
  }

  return Array.from(links).sort((a, b) => a.localeCompare(b));
}

export function extractTags(markdown: string): string[] {
  const tags = new Set<string>();
  const regex = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown))) {
    const tag = match[2]?.trim();
    if (tag && !/^\d+$/.test(tag)) tags.add(tag);
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

export function getNoteTitle(fileName: string): string {
  return fileName.replace(/\.(md|markdown)$/i, '');
}

export function makePreview(markdown: string, maxLength = 140): string {
  const compact = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\-\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!compact) return 'No preview yet';
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

export function buildBacklinks(currentTitle: string, notes: { title: string; links: string[] }[]): string[] {
  const normalized = currentTitle.toLowerCase();
  return notes
    .filter((note) => note.title.toLowerCase() !== normalized)
    .filter((note) => note.links.some((link) => link.toLowerCase() === normalized))
    .map((note) => note.title)
    .sort((a, b) => a.localeCompare(b));
}

export function makeDailyNoteName(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}.md`;
}

export function makeDailyNoteTemplate(date = new Date()): string {
  const display = date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `# ${display}\n\n## Notes\n\n- \n\n## Tasks\n\n- [ ] \n\n#daily\n`;
}
