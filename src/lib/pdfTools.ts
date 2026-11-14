import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { degrees, PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type { AppFile } from '../types';

const OUTPUT_DIR = `${FileSystem.documentDirectory ?? ''}file-tool/pdf-tools/`;

type PdfToolResult = {
  uri: string;
  name: string;
  pageCount: number;
};

async function ensureOutputDir() {
  if (!FileSystem.documentDirectory) return;
  const info = await FileSystem.getInfoAsync(OUTPUT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OUTPUT_DIR, { intermediates: true });
  }
}

function cleanBaseName(name: string): string {
  return (
    name
      .replace(/\.pdf$/i, '')
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 70) || 'document'
  );
}

async function loadPdf(file: AppFile): Promise<PDFDocument> {
  const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
  return PDFDocument.load(base64, { ignoreEncryption: true });
}

async function savePdf(doc: PDFDocument, outputName: string): Promise<PdfToolResult> {
  await ensureOutputDir();
  const base64 = await doc.saveAsBase64({ dataUri: false });
  const uri = `${OUTPUT_DIR}${encodeURIComponent(outputName)}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, name: outputName, pageCount: doc.getPageCount() };
}

export async function getPdfPageCount(file: AppFile): Promise<number> {
  const doc = await loadPdf(file);
  return doc.getPageCount();
}

export async function addTextStampToPdf(file: AppFile, text: string): Promise<PdfToolResult> {
  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const stamp = text.trim() || 'Personal File Tool';

  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const fontSize = Math.max(10, Math.min(16, width / 42));
    page.drawText(stamp, {
      x: 28,
      y: Math.max(24, height - 38),
      size: fontSize,
      font,
      color: rgb(0.22, 0.22, 0.22),
      opacity: 0.72,
    });
  });

  return savePdf(doc, `${cleanBaseName(file.name)} - stamped.pdf`);
}

export async function extractPdfPages(file: AppFile, startPage: number, endPage: number): Promise<PdfToolResult> {
  const source = await loadPdf(file);
  const pageCount = source.getPageCount();
  const start = Math.max(1, Math.min(startPage || 1, pageCount));
  const end = Math.max(start, Math.min(endPage || start, pageCount));
  const output = await PDFDocument.create();
  const indexes = Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index);
  const pages = await output.copyPages(source, indexes);
  pages.forEach((page) => output.addPage(page));

  return savePdf(output, `${cleanBaseName(file.name)} - pages ${start}-${end}.pdf`);
}

export async function removePdfPage(file: AppFile, pageNumber: number): Promise<PdfToolResult> {
  const source = await loadPdf(file);
  const pageCount = source.getPageCount();

  if (pageCount <= 1) {
    throw new Error('This PDF has only one page, so no page can be removed.');
  }

  const removeIndex = Math.max(0, Math.min((pageNumber || 1) - 1, pageCount - 1));
  const output = await PDFDocument.create();
  const keepIndexes = Array.from({ length: pageCount }, (_, index) => index).filter((index) => index !== removeIndex);
  const pages = await output.copyPages(source, keepIndexes);
  pages.forEach((page) => output.addPage(page));

  return savePdf(output, `${cleanBaseName(file.name)} - page ${removeIndex + 1} removed.pdf`);
}

export async function mergePdfFiles(primary: AppFile, secondary: AppFile): Promise<PdfToolResult> {
  const first = await loadPdf(primary);
  const second = await loadPdf(secondary);
  const output = await PDFDocument.create();

  const firstPages = await output.copyPages(first, first.getPageIndices());
  firstPages.forEach((page) => output.addPage(page));

  const secondPages = await output.copyPages(second, second.getPageIndices());
  secondPages.forEach((page) => output.addPage(page));

  return savePdf(output, `${cleanBaseName(primary.name)} + ${cleanBaseName(secondary.name)}.pdf`);
}

export async function addHighlightToPdf(file: AppFile, pageNumber: number): Promise<PdfToolResult> {
  const doc = await loadPdf(file);
  const pageCount = doc.getPageCount();
  const pageIndex = Math.max(0, Math.min((pageNumber || 1) - 1, pageCount - 1));
  const page = doc.getPages()[pageIndex];
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: width * 0.12,
    y: height * 0.72,
    width: width * 0.76,
    height: Math.max(18, height * 0.035),
    color: rgb(1, 0.92, 0.28),
    opacity: 0.45,
    borderColor: rgb(0.88, 0.72, 0.1),
    borderWidth: 0.5,
  });

  return savePdf(doc, `${cleanBaseName(file.name)} - highlighted p${pageIndex + 1}.pdf`);
}

export async function rotatePdfPage(file: AppFile, pageNumber: number, clockwise = true): Promise<PdfToolResult> {
  const doc = await loadPdf(file);
  const pageCount = doc.getPageCount();
  const pageIndex = Math.max(0, Math.min((pageNumber || 1) - 1, pageCount - 1));
  const page = doc.getPages()[pageIndex];
  const current = page.getRotation().angle;
  const next = clockwise ? current + 90 : current - 90;
  page.setRotation(degrees(((next % 360) + 360) % 360));

  return savePdf(doc, `${cleanBaseName(file.name)} - rotated p${pageIndex + 1}.pdf`);
}

export async function movePdfPage(file: AppFile, pageNumber: number, target: 'front' | 'end'): Promise<PdfToolResult> {
  const source = await loadPdf(file);
  const pageCount = source.getPageCount();
  if (pageCount <= 1) {
    throw new Error('This PDF has only one page, so pages cannot be reordered.');
  }

  const moveIndex = Math.max(0, Math.min((pageNumber || 1) - 1, pageCount - 1));
  const remaining = Array.from({ length: pageCount }, (_, index) => index).filter((index) => index !== moveIndex);
  const ordered = target === 'front' ? [moveIndex, ...remaining] : [...remaining, moveIndex];
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, ordered);
  pages.forEach((page) => output.addPage(page));

  return savePdf(output, `${cleanBaseName(file.name)} - page ${moveIndex + 1} moved ${target}.pdf`);
}

export async function splitPdfToZip(file: AppFile): Promise<{ uri: string; name: string; pageCount: number }> {
  await ensureOutputDir();
  const source = await loadPdf(file);
  const pageCount = source.getPageCount();
  const zip = new JSZip();
  const baseName = cleanBaseName(file.name);

  for (let index = 0; index < pageCount; index += 1) {
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [index]);
    output.addPage(page);
    const base64 = await output.saveAsBase64({ dataUri: false });
    zip.file(`${baseName} - page ${index + 1}.pdf`, base64, { base64: true });
  }

  const zipBase64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  const name = `${baseName} - split pages.zip`;
  const uri = `${OUTPUT_DIR}${encodeURIComponent(name)}`;
  await FileSystem.writeAsStringAsync(uri, zipBase64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, name, pageCount };
}
