import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

import type { AppFile, RecentFile } from '../types';
import { getNameFromUri, makeAppFile, toRecentFile } from './fileTypes';
import { extractDocxText } from './docx';

const APP_DIR = `${FileSystem.documentDirectory ?? ''}file-tool/`;
const NOTES_DIR = `${APP_DIR}notes/`;
const RECENTS_FILE = `${APP_DIR}recents.json`;
const MAX_TEXT_READ_BYTES = 5 * 1024 * 1024;

async function ensureDir(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

export async function ensureAppStorage() {
  if (!FileSystem.documentDirectory) return;
  await ensureDir(APP_DIR);
  await ensureDir(NOTES_DIR);
}

export async function loadRecents(): Promise<RecentFile[]> {
  try {
    await ensureAppStorage();
    const info = await FileSystem.getInfoAsync(RECENTS_FILE);
    if (!info.exists) return [];

    const raw = await FileSystem.readAsStringAsync(RECENTS_FILE);
    const parsed = JSON.parse(raw) as RecentFile[];
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export async function saveRecents(files: RecentFile[]) {
  await ensureAppStorage();
  await FileSystem.writeAsStringAsync(RECENTS_FILE, JSON.stringify(files.slice(0, 40), null, 2));
}

export async function addRecent(file: AppFile, current: RecentFile[]): Promise<RecentFile[]> {
  const recent = toRecentFile(file);
  const next = [recent, ...current.filter((item) => item.uri !== file.uri)].slice(0, 40);
  await saveRecents(next);
  return next;
}

export async function hydrateTextContent(file: AppFile): Promise<AppFile> {
  if (file.kind === 'docx') {
    try {
      const textContent = await extractDocxText(file.uri);
      return { ...file, textContent };
    } catch (error) {
      return {
        ...file,
        readError: error instanceof Error ? error.message : 'Could not extract text from this DOCX.',
      };
    }
  }

  if (!file.isTextLike) return file;
  if (file.size && file.size > MAX_TEXT_READ_BYTES) {
    return {
      ...file,
      readError: 'Large text file. Preview is skipped to keep the app fast.',
    };
  }

  try {
    const textContent = await FileSystem.readAsStringAsync(file.uri);
    return { ...file, textContent };
  } catch (error) {
    return {
      ...file,
      readError: error instanceof Error ? error.message : 'Could not read this file as text.',
    };
  }
}

export async function saveTextContent(file: AppFile, content: string): Promise<AppFile> {
  await FileSystem.writeAsStringAsync(file.uri, content);
  const info = await FileSystem.getInfoAsync(file.uri);
  return {
    ...file,
    textContent: content,
    size: info.exists ? info.size ?? file.size : file.size,
    openedAt: Date.now(),
  };
}

export async function createNote(name: string, template = ''): Promise<AppFile> {
  await ensureAppStorage();
  const cleanBase = name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  const fileName = cleanBase.toLowerCase().endsWith('.md') ? cleanBase : `${cleanBase || 'Untitled'}.md`;
  const uri = `${NOTES_DIR}${encodeURIComponent(fileName)}`;

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(uri, template || `# ${fileName.replace(/\.md$/i, '')}\n\n`);
  }

  const file = makeAppFile({
    uri,
    name: fileName,
    mimeType: 'text/markdown',
    size: info.exists ? info.size ?? null : template.length,
    source: 'created',
  });

  return hydrateTextContent(file);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function exportTextToPdf(file: AppFile, content: string): Promise<string> {
  const title = escapeHtml(file.name);
  const body = escapeHtml(content).replace(/\n/g, '<br />');
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 28px; color: #171717; }
      h1 { font-size: 18px; margin: 0 0 20px; }
      .content { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.55; white-space: normal; }
      .meta { color: #777; font-size: 10px; margin-bottom: 18px; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <div class="meta">Exported from Personal File Tool</div>
    <div class="content">${body}</div>
  </body>
</html>`;

  const result = await Print.printToFileAsync({ html, base64: false });
  return result.uri;
}

export async function exportTextAsFile(
  file: AppFile,
  content: string,
  extension: 'txt' | 'md'
): Promise<string> {
  await ensureAppStorage();
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80) || 'export';
  const outputName = `${baseName}.${extension}`;
  const uri = `${APP_DIR}${encodeURIComponent(outputName)}`;
  await FileSystem.writeAsStringAsync(uri, content);
  return uri;
}

export async function shareFile(uri: string, mimeType?: string | null) {
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  await Sharing.shareAsync(uri, {
    mimeType: mimeType ?? undefined,
    dialogTitle: 'Share file',
  });
  return true;
}

export async function openExternally(file: AppFile) {
  if (Platform.OS === 'android') {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: file.uri,
      type: file.mimeType ?? '*/*',
      flags: 1,
    });
    return;
  }

  await shareFile(file.uri, file.mimeType);
}

export async function requestVaultDirectory(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return null;
  return permissions.directoryUri;
}

function getDisplayNameForDocumentUri(uri: string): string {
  const decoded = getNameFromUri(uri, 'File');
  return decoded.split('/').pop()?.split(':').pop() || decoded || 'File';
}

async function tryReadSafDirectory(uri: string): Promise<string[] | null> {
  try {
    return await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
  } catch {
    return null;
  }
}

export async function readVaultDirectory(directoryUri: string): Promise<AppFile[]> {
  const files: AppFile[] = [];
  const maxFiles = 400;
  const maxDepth = 4;

  async function walk(uri: string, depth: number) {
    if (files.length >= maxFiles) return;
    const children = await tryReadSafDirectory(uri);

    if (!children || depth >= maxDepth) {
      files.push(
        makeAppFile({
          uri,
          name: getDisplayNameForDocumentUri(uri),
          source: 'vault',
        })
      );
      return;
    }

    for (const child of children) {
      if (files.length >= maxFiles) break;
      const nested = await tryReadSafDirectory(child);
      if (nested) {
        for (const nestedChild of nested) {
          if (files.length >= maxFiles) break;
          const deeper = await tryReadSafDirectory(nestedChild);
          if (deeper && depth + 2 < maxDepth) {
            await walk(nestedChild, depth + 2);
          } else {
            files.push(
              makeAppFile({
                uri: nestedChild,
                name: getDisplayNameForDocumentUri(nestedChild),
                source: 'vault',
              })
            );
          }
        }
      } else {
        files.push(
          makeAppFile({
            uri: child,
            name: getDisplayNameForDocumentUri(child),
            source: 'vault',
          })
        );
      }
    }
  }

  await walk(directoryUri, 0);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
