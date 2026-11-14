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
  return value.replace(/<[^>]+>/g, '');
}

function extractParagraphText(paragraphXml: string): string {
  const pieces: string[] = [];
  const textRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(paragraphXml))) {
    pieces.push(decodeXmlEntities(match[1] ?? ''));
  }

  if (!pieces.length) {
    const fallback = decodeXmlEntities(stripXmlTags(paragraphXml)).trim();
    return fallback;
  }

  return pieces.join('').trimEnd();
}

function extractDocumentXmlText(xml: string): string {
  const paragraphs: string[] = [];
  const paragraphRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphRegex.exec(xml))) {
    const text = extractParagraphText(match[1] ?? '');
    paragraphs.push(text);
  }

  return paragraphs
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export async function extractDocxText(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const documentXml = zip.file('word/document.xml');

  if (!documentXml) {
    throw new Error('This DOCX does not contain word/document.xml.');
  }

  const xml = await documentXml.async('string');
  const body = extractDocumentXmlText(xml);

  return body || 'This DOCX opened, but no readable text was found.';
}
