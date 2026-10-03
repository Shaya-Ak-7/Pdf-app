import type { AppFile, FileKind, FileSource, RecentFile } from '../types';

const codeExtensions = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'java',
  'kt',
  'kts',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'go',
  'rs',
  'php',
  'rb',
  'swift',
  'dart',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'json',
  'jsonc',
  'xml',
  'yml',
  'yaml',
  'toml',
  'ini',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'sql',
  'gradle',
  'lua',
  'r',
  'm',
]);

const textExtensions = new Set([
  'txt',
  'log',
  'csv',
  'tsv',
  'rtf',
  'text',
  'conf',
  'config',
  'env',
  'gitignore',
  'dockerignore',
  'license',
  'readme',
]);

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif']);
const archiveExtensions = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'apk', 'ipa', 'jar']);
const audioExtensions = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus']);
const videoExtensions = new Set(['mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v']);
const spreadsheetExtensions = new Set(['xls', 'xlsx', 'ods']);
const presentationExtensions = new Set(['ppt', 'pptx', 'odp']);

export function getExtension(nameOrUri: string): string {
  const clean = decodeURIComponent(nameOrUri.split('?')[0] ?? nameOrUri)
    .split('/')
    .pop()
    ?.trim()
    .toLowerCase();

  if (!clean) return '';
  if (!clean.includes('.')) return clean === 'readme' || clean === 'license' ? clean : '';

  return clean.split('.').pop() ?? '';
}

export function getNameFromUri(uri: string, fallback = 'Untitled'): string {
  try {
    const withoutQuery = uri.split('?')[0] ?? uri;
    const name = decodeURIComponent(withoutQuery.split('/').pop() ?? '').trim();
    return name || fallback;
  } catch {
    return fallback;
  }
}

export function detectFileKind(name: string, mimeType?: string | null): FileKind {
  const ext = getExtension(name);
  const mime = (mimeType ?? '').toLowerCase();

  if (ext === 'md' || ext === 'markdown' || mime === 'text/markdown') return 'markdown';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'docx' || mime.includes('officedocument.wordprocessingml') || mime === 'application/msword') return 'docx';
  if (spreadsheetExtensions.has(ext) || mime.includes('spreadsheet') || mime.includes('excel')) return 'spreadsheet';
  if (presentationExtensions.has(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation';
  if (imageExtensions.has(ext) || mime.startsWith('image/')) return 'image';
  if (audioExtensions.has(ext) || mime.startsWith('audio/')) return 'audio';
  if (videoExtensions.has(ext) || mime.startsWith('video/')) return 'video';
  if (archiveExtensions.has(ext) || mime.includes('zip') || mime.includes('archive')) return 'archive';
  if (codeExtensions.has(ext)) return 'code';
  if (textExtensions.has(ext) || mime.startsWith('text/')) return 'text';

  return 'unknown';
}

export function isTextLike(kind: FileKind, name: string, mimeType?: string | null): boolean {
  if (kind === 'markdown' || kind === 'text' || kind === 'code') return true;
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('text/')) return true;
  const ext = getExtension(name);
  return codeExtensions.has(ext) || textExtensions.has(ext);
}

export function isEditable(kind: FileKind): boolean {
  return kind === 'markdown' || kind === 'text' || kind === 'code';
}

export function makeFileId(uri: string, name: string): string {
  return `${name}:${uri}`.replace(/[^a-z0-9_.:-]+/gi, '-');
}

export function makeAppFile(input: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
  lastModified?: number | null;
  source: FileSource;
}): AppFile {
  const name = input.name?.trim() || getNameFromUri(input.uri);
  const kind = detectFileKind(name, input.mimeType);
  const extension = getExtension(name);

  return {
    id: makeFileId(input.uri, name),
    name,
    uri: input.uri,
    extension,
    mimeType: input.mimeType,
    size: input.size,
    lastModified: input.lastModified,
    kind,
    source: input.source,
    openedAt: Date.now(),
    isEditable: isEditable(kind),
    isTextLike: isTextLike(kind, name, input.mimeType),
  };
}

export function toRecentFile(file: AppFile): RecentFile {
  const { textContent: _textContent, readError: _readError, ...recent } = file;
  return recent;
}

export function formatBytes(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return 'Unknown size';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function getKindLabel(kind: FileKind): string {
  switch (kind) {
    case 'markdown':
      return 'Markdown';
    case 'text':
      return 'Text';
    case 'code':
      return 'Code';
    case 'pdf':
      return 'PDF';
    case 'docx':
      return 'DOCX';
    case 'image':
      return 'Image';
    case 'spreadsheet':
      return 'Spreadsheet';
    case 'presentation':
      return 'Presentation';
    case 'archive':
      return 'Archive';
    case 'audio':
      return 'Audio';
    case 'video':
      return 'Video';
    default:
      return 'File';
  }
}

export function getViewerHint(file: AppFile): string {
  switch (file.kind) {
    case 'markdown':
      return 'Preview opens first. Edit mode supports wiki links, tags, and simple markdown.';
    case 'text':
      return 'Readable text preview with edit, find, replace, save, and export.';
    case 'code':
      return 'Code preview/edit for small changes. Full IDE features are intentionally skipped.';
    case 'pdf':
      return 'Drive-style PDF shell is ready. Native page rendering, search, and annotations are the next module.';
    case 'docx':
      return 'DOCX opens as document preview metadata first. Text extraction/rendering is the next module.';
    case 'image':
      return 'Image preview with zoom-style fit.';
    default:
      return 'Unsupported files still open here with metadata and actions.';
  }
}
