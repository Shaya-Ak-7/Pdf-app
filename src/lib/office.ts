import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripXmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function loadZip(uri: string): Promise<JSZip> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return JSZip.loadAsync(base64, { base64: true });
}

/* ---------------- XLSX / ODS (spreadsheet → readable text) ---------------- */

function readSharedStrings(xml: string): string[] {
  const items: string[] = [];
  const siRegex = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  const tRegex = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml))) {
    const parts: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(siMatch[1] ?? ''))) {
      parts.push(decodeXmlEntities(tMatch[1] ?? ''));
    }
    items.push(parts.join(''));
  }
  return items;
}

function readSheetXml(xml: string, shared: string[], maxRows = 400): string[] {
  const rows: string[] = [];
  const rowRegex = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(xml)) && rows.length < maxRows) {
    const cells: string[] = [];
    const cellRegex = /<c(?:\s([^>]*))?>([\s\S]*?)<\/c>|<c(?:\s[^>]*)\/>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1] ?? ''))) {
      const attrs = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const typeMatch = /t="([^"]+)"/.exec(attrs);
      const type = typeMatch?.[1] ?? '';
      const vMatch = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);
      const tMatch = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/.exec(body);
      let value = '';
      if (type === 's' && vMatch) {
        value = shared[Number.parseInt(vMatch[1] ?? '0', 10)] ?? '';
      } else if (type === 'inlineStr' && tMatch) {
        value = decodeXmlEntities(tMatch[1] ?? '');
      } else if (vMatch) {
        value = decodeXmlEntities(vMatch[1] ?? '');
      } else if (tMatch) {
        value = decodeXmlEntities(tMatch[1] ?? '');
      }
      cells.push(value.trim());
    }
    if (cells.some((cell) => cell.length > 0)) rows.push(cells.join('\t'));
  }
  return rows;
}

async function extractXlsxText(zip: JSZip): Promise<string> {
  const sharedEntry = zip.file('xl/sharedStrings.xml');
  const shared = sharedEntry ? readSharedStrings(await sharedEntry.async('string')) : [];

  let sheetNames: string[] = [];
  const workbook = zip.file('xl/workbook.xml');
  if (workbook) {
    const wbXml = await workbook.async('string');
    const nameRegex = /<sheet\s[^>]*name="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = nameRegex.exec(wbXml))) sheetNames.push(decodeXmlEntities(m[1] ?? ''));
  }

  const sheetFiles = Object.keys(zip.files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, '')))
    .slice(0, 6);

  if (!sheetFiles.length) throw new Error('This spreadsheet has no readable sheets.');

  const blocks: string[] = [];
  for (let i = 0; i < sheetFiles.length; i += 1) {
    const xml = await zip.file(sheetFiles[i])!.async('string');
    const rows = readSheetXml(xml, shared);
    const title = sheetNames[i] || `Sheet ${i + 1}`;
    blocks.push(`— ${title} —\n${rows.join('\n') || '(empty sheet)'}`);
  }
  return blocks.join('\n\n');
}

/* ---------------- PPTX / ODP (slides → readable text) ---------------- */

async function extractPptxText(zip: JSZip): Promise<string> {
  const slideFiles = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, '')))
    .slice(0, 120);

  if (!slideFiles.length) throw new Error('This presentation has no readable slides.');

  const blocks: string[] = [];
  for (let i = 0; i < slideFiles.length; i += 1) {
    const xml = await zip.file(slideFiles[i])!.async('string');
    const texts: string[] = [];
    const tRegex = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
    let m: RegExpExecArray | null;
    while ((m = tRegex.exec(xml))) texts.push(decodeXmlEntities(m[1] ?? ''));
    blocks.push(`— Slide ${i + 1} —\n${texts.join('\n').trim() || '(no text)'}`);
  }
  return blocks.join('\n\n');
}

/* ---------------- ODF (ods / odp / odt share content.xml) ---------------- */

async function extractOdfText(zip: JSZip): Promise<string> {
  const content = zip.file('content.xml');
  if (!content) throw new Error('No content.xml inside this OpenDocument file.');
  const xml = await content.async('string');
  const paragraphs: string[] = [];
  const pRegex = /<text:p(?:\s[^>]*)?>([\s\S]*?)<\/text:p>|<text:h(?:\s[^>]*)?>([\s\S]*?)<\/text:h>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xml)) && paragraphs.length < 1500) {
    const text = decodeXmlEntities(stripXmlTags(m[1] ?? m[2] ?? ''));
    if (text) paragraphs.push(text);
  }
  return paragraphs.join('\n');
}

/* ---------------- Public API ---------------- */

export async function extractSpreadsheetText(uri: string): Promise<string> {
  const zip = await loadZip(uri).catch(() => {
    throw new Error('Legacy/binary spreadsheet. Use Open external for full fidelity.');
  });
  if (zip.file('content.xml')) return (await extractOdfText(zip)) || 'Spreadsheet opened, but no text found.';
  return extractXlsxText(zip);
}

export async function extractPresentationText(uri: string): Promise<string> {
  const zip = await loadZip(uri).catch(() => {
    throw new Error('Legacy/binary presentation. Use Open external for full fidelity.');
  });
  if (zip.file('content.xml')) return (await extractOdfText(zip)) || 'Presentation opened, but no text found.';
  return extractPptxText(zip);
}

export async function extractOdtText(uri: string): Promise<string> {
  const zip = await loadZip(uri);
  return (await extractOdfText(zip)) || 'Document opened, but no text found.';
}

/** Drive-style archive contents list (zip / apk / jar / tar-like zip). */
export async function listArchiveContents(uri: string): Promise<string> {
  const zip = await loadZip(uri).catch(() => {
    throw new Error('Not a ZIP-based archive (or corrupted). Use Open external for this file.');
  });
  const lines: string[] = [];
  zip.forEach((path, entry) => {
    if (lines.length >= 800) return;
    if (entry.dir) {
      lines.push(`📁 ${path}`);
    } else {
      const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
      lines.push(`${path}${typeof size === 'number' ? `\t(${formatSize(size)})` : ''}`);
    }
  });
  return lines.join('\n') || 'Archive opened, but it looks empty.';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
