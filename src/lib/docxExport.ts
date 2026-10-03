import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';

const OUTPUT_DIR = `${FileSystem.documentDirectory ?? ''}file-tool/docx-export/`;

async function ensureOutputDir() {
  if (!FileSystem.documentDirectory) return;
  const info = await FileSystem.getInfoAsync(OUTPUT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OUTPUT_DIR, { intermediates: true });
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanBaseName(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 70) || 'document'
  );
}

function runXml(text: string, bold = false, italic = false): string {
  const properties = bold || italic ? `<w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}</w:rPr>` : '';
  return `<w:r>${properties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function inlineRuns(line: string): string {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const runs: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line))) {
    if (match.index > lastIndex) runs.push(runXml(line.slice(lastIndex, match.index)));
    const token = match[0];
    if (token.startsWith('**')) runs.push(runXml(token.slice(2, -2), true));
    else runs.push(runXml(token.slice(1, -1), false, true));
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) runs.push(runXml(line.slice(lastIndex)));
  return runs.join('') || runXml(line);
}

function paragraphXml(line: string): string {
  if (!line.trim()) {
    return '<w:p />';
  }

  const heading = /^(#{1,3})\s+(.+)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    const size = level === 1 ? 32 : level === 2 ? 26 : 22;
    return `<w:p><w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(heading[2])}</w:t></w:r></w:p>`;
  }

  const task = /^- \[([ xX])\]\s+(.+)$/.exec(line.trim());
  if (task) {
    return `<w:p><w:r><w:t xml:space="preserve">${task[1].toLowerCase() === 'x' ? '☑' : '☐'} </w:t></w:r>${inlineRuns(task[2])}</w:p>`;
  }

  const bullet = /^[-*]\s+(.+)$/.exec(line.trim());
  if (bullet) {
    return `<w:p><w:r><w:t xml:space="preserve">• </w:t></w:r>${inlineRuns(bullet[1])}</w:p>`;
  }

  return `<w:p>${inlineRuns(line)}</w:p>`;
}

function documentXml(content: string): string {
  const paragraphs = content.replace(/\r\n/g, '\n').split('\n').map(paragraphXml).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;
}

export async function createDocxFromText(name: string, content: string): Promise<{ uri: string; name: string }> {
  await ensureOutputDir();
  const outputName = `${cleanBaseName(name)}.docx`;
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
  );

  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
  );

  zip.folder('word')?.file('document.xml', documentXml(content));
  zip.folder('word')?.folder('_rels')?.file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );

  zip.folder('docProps')?.file(
    'core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(cleanBaseName(name))}</dc:title>
  <dc:creator>Personal File Tool</dc:creator>
</cp:coreProperties>`
  );

  zip.folder('docProps')?.file(
    'app.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Personal File Tool</Application>
</Properties>`
  );

  const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  const uri = `${OUTPUT_DIR}${encodeURIComponent(outputName)}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

  return { uri, name: outputName };
}
