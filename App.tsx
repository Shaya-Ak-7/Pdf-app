import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';

import { createTheme, type AppTheme } from './src/theme';
import type { AppFile, AppScreen, RecentFile } from './src/types';
import { formatBytes, getKindLabel, getViewerHint, makeAppFile } from './src/lib/fileTypes';
import {
  addRecent,
  createNote,
  exportTextAsFile,
  exportTextToPdf,
  hydrateTextContent,
  loadRecents,
  openExternally,
  readVaultDirectory,
  requestVaultDirectory,
  saveTextContent,
  shareFile,
} from './src/lib/storage';
import {
  buildBacklinks,
  extractTags,
  extractWikiLinks,
  getNoteTitle,
  makeDailyNoteName,
  makeDailyNoteTemplate,
  makePreview,
} from './src/lib/markdown';
import { PdfPreview } from './src/components/PdfPreview';
import { buildVaultIndex, filterVaultFiles, type VaultIndex } from './src/lib/vault';

type Notice = { tone: 'info' | 'error' | 'success'; text: string } | null;

export default function App() {
  const colorScheme = useColorScheme();
  const theme = useMemo(() => createTheme(colorScheme), [colorScheme]);

  const [screen, setScreen] = useState<AppScreen>('home');
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [activeFile, setActiveFile] = useState<AppFile | null>(null);
  const [editorText, setEditorText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [noteName, setNoteName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [vaultUri, setVaultUri] = useState<string | null>(null);
  const [vaultFiles, setVaultFiles] = useState<AppFile[]>([]);
  const [vaultIndex, setVaultIndex] = useState<VaultIndex | null>(null);
  const [vaultQuery, setVaultQuery] = useState('');
  const [activeVaultTag, setActiveVaultTag] = useState<string | null>(null);

  const markdownStats = useMemo(() => {
    const content = editorText || activeFile?.textContent || '';
    const title = activeFile ? getNoteTitle(activeFile.name) : '';
    const links = extractWikiLinks(content);
    const tags = extractTags(content);
    const notePool = vaultIndex?.notes?.length
      ? vaultIndex.notes.map((note) => ({ title: note.title, links: note.links }))
      : recents.filter((file) => file.kind === 'markdown').map((file) => ({ title: getNoteTitle(file.name), links: [] }));
    return {
      links,
      tags,
      backlinks: buildBacklinks(title, notePool),
      preview: makePreview(content),
    };
  }, [activeFile, editorText, recents, vaultIndex]);

  const matchCount = useMemo(() => {
    if (!searchTerm) return 0;
    return editorText.toLowerCase().split(searchTerm.toLowerCase()).length - 1;
  }, [editorText, searchTerm]);

  useEffect(() => {
    loadRecents().then(setRecents).catch(() => undefined);
    handleIncomingShare().catch(() => undefined);
    Linking.getInitialURL()
      .then((url) => {
        if (url) return handleIncomingUrl(url);
        return null;
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url).catch(() => undefined);
    });

    return () => subscription.remove();
  }, []);

  async function runBusy<T>(label: string, task: () => Promise<T>): Promise<T | null> {
    setBusyLabel(label);
    setNotice(null);
    try {
      return await task();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' });
      return null;
    } finally {
      setBusyLabel(null);
    }
  }

  async function openFile(file: AppFile) {
    await runBusy('Opening file', async () => {
      const hydrated = await hydrateTextContent(file);
      setActiveFile(hydrated);
      setEditorText(hydrated.textContent ?? '');
      setSearchTerm('');
      setReplaceTerm('');
      setIsEditing(false);
      setScreen('viewer');
      const next = await addRecent(hydrated, recents);
      setRecents(next);
      return hydrated;
    });
  }

  async function handlePickFile() {
    await runBusy('Opening picker', async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return null;

      const asset = result.assets[0];
      await openFile(
        makeAppFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
          lastModified: asset.lastModified,
          source: 'picker',
        })
      );
      return null;
    });
  }

  async function handleIncomingShare() {
    const resolved = await Sharing.getResolvedSharedPayloadsAsync();
    if (!resolved.length) return;

    const payload = resolved[0];

    if (payload.contentUri) {
      await openFile(
        makeAppFile({
          uri: payload.contentUri,
          name: payload.originalName ?? undefined,
          mimeType: payload.contentMimeType ?? payload.mimeType,
          size: payload.contentSize,
          source: 'share',
        })
      );
    } else if (payload.value) {
      const sharedNote = await createNote(`Shared ${Date.now()}.md`, payload.value);
      await openFile(sharedNote);
    }

    Sharing.clearSharedPayloads();
  }

  async function handleIncomingUrl(url: string) {
    if (!url || url.startsWith('exp://') || url.startsWith('http://') || url.startsWith('https://')) return;

    await openFile(
      makeAppFile({
        uri: url,
        source: 'share',
      })
    );
  }

  async function handleOpenRecent(file: RecentFile) {
    await openFile({ ...file, source: 'recent', openedAt: Date.now() });
  }

  async function handleCreateNote() {
    const name = noteName.trim() || 'Untitled.md';
    await runBusy('Creating note', async () => {
      const file = await createNote(name);
      setNoteName('');
      await openFile(file);
      return file;
    });
  }

  async function handleDailyNote() {
    await runBusy('Creating daily note', async () => {
      const file = await createNote(makeDailyNoteName(), makeDailyNoteTemplate());
      await openFile(file);
      return file;
    });
  }

  async function handleSave() {
    if (!activeFile || !activeFile.isEditable) return;

    await runBusy('Saving', async () => {
      const saved = await saveTextContent(activeFile, editorText);
      setActiveFile(saved);
      const next = await addRecent(saved, recents);
      setRecents(next);
      if (vaultFiles.some((file) => file.uri === saved.uri)) {
        const refreshedFiles = vaultFiles.map((file) => (file.uri === saved.uri ? saved : file));
        setVaultFiles(refreshedFiles);
        setVaultIndex(await buildVaultIndex(refreshedFiles));
      }
      setNotice({ tone: 'success', text: 'Saved to the current local file copy.' });
      return saved;
    });
  }

  async function handleShareActive() {
    if (!activeFile) return;
    await runBusy('Preparing share', async () => {
      const shared = await shareFile(activeFile.uri, activeFile.mimeType);
      if (!shared) setNotice({ tone: 'error', text: 'Sharing is not available on this device.' });
      return shared;
    });
  }

  async function handleOpenExternal() {
    if (!activeFile) return;
    await runBusy('Opening externally', async () => openExternally(activeFile));
  }

  async function handleExportPdf() {
    if (!activeFile) return;
    const content = editorText || activeFile.textContent || '';
    if (!activeFile.isTextLike && activeFile.kind !== 'docx') {
      setNotice({ tone: 'error', text: 'PDF export is ready for text, markdown, code, and extracted DOCX text first.' });
      return;
    }

    await runBusy('Exporting PDF', async () => {
      const pdfUri = await exportTextToPdf(activeFile, content);
      await shareFile(pdfUri, 'application/pdf');
      setNotice({ tone: 'success', text: 'PDF exported. Use the share sheet to save it anywhere.' });
      return pdfUri;
    });
  }

  async function handleExportText(extension: 'txt' | 'md') {
    if (!activeFile) return;
    const content = editorText || activeFile.textContent || '';
    if (!content) {
      setNotice({ tone: 'error', text: 'No readable text is available to export.' });
      return;
    }

    await runBusy(`Exporting ${extension.toUpperCase()}`, async () => {
      const uri = await exportTextAsFile(activeFile, content, extension);
      await shareFile(uri, extension === 'md' ? 'text/markdown' : 'text/plain');
      setNotice({ tone: 'success', text: `${extension.toUpperCase()} exported. Use the share sheet to save it anywhere.` });
      return uri;
    });
  }

  async function handlePickVault() {
    await runBusy('Opening folder', async () => {
      const uri = await requestVaultDirectory();
      if (!uri) {
        setNotice({
          tone: 'info',
          text:
            Platform.OS === 'android'
              ? 'Folder permission was not granted.'
              : 'Folder vault picker is Android-first for now. You can still open/create files.',
        });
        return null;
      }

      const files = await readVaultDirectory(uri);
      const index = await buildVaultIndex(files);
      setVaultUri(uri);
      setVaultFiles(files);
      setVaultIndex(index);
      setActiveVaultTag(null);
      setScreen('vault');
      return files;
    });
  }

  function replaceOne() {
    if (!searchTerm) return;
    setEditorText((current) => current.replace(new RegExp(escapeRegex(searchTerm), 'i'), replaceTerm));
  }

  function replaceAll() {
    if (!searchTerm) return;
    setEditorText((current) => current.replace(new RegExp(escapeRegex(searchTerm), 'gi'), replaceTerm));
  }

  const screenContent = (() => {
    if (screen === 'viewer' && activeFile) {
      return (
        <ViewerScreen
          activeFile={activeFile}
          editorText={editorText}
          isEditing={isEditing}
          markdownStats={markdownStats}
          matchCount={matchCount}
          replaceAll={replaceAll}
          replaceOne={replaceOne}
          replaceTerm={replaceTerm}
          searchTerm={searchTerm}
          setEditorText={setEditorText}
          setIsEditing={setIsEditing}
          setReplaceTerm={setReplaceTerm}
          setSearchTerm={setSearchTerm}
          vaultIndex={vaultIndex}
          onBack={() => setScreen('home')}
          onExportPdf={handleExportPdf}
          onExportText={handleExportText}
          onOpenFile={openFile}
          onOpenExternal={handleOpenExternal}
          onSave={handleSave}
          onShare={handleShareActive}
          theme={theme}
        />
      );
    }

    if (screen === 'convert') {
      return (
        <ConvertScreen
          activeFile={activeFile}
          onBack={() => setScreen('home')}
          onExportPdf={handleExportPdf}
          onExportText={handleExportText}
          onPickFile={handlePickFile}
          theme={theme}
        />
      );
    }

    if (screen === 'settings') {
      return <SettingsScreen onBack={() => setScreen('home')} theme={theme} />;
    }

    if (screen === 'vault') {
      return (
        <VaultScreen
          activeTag={activeVaultTag}
          files={vaultFiles}
          index={vaultIndex}
          query={vaultQuery}
          setActiveTag={setActiveVaultTag}
          setQuery={setVaultQuery}
          uri={vaultUri}
          onBack={() => setScreen('home')}
          onOpenFile={openFile}
          onPickVault={handlePickVault}
          theme={theme}
        />
      );
    }

    return (
      <HomeScreen
        noteName={noteName}
        recents={recents}
        setNoteName={setNoteName}
        onCreateNote={handleCreateNote}
        onDailyNote={handleDailyNote}
        onOpenConvert={() => setScreen('convert')}
        onOpenFile={handlePickFile}
        onOpenRecent={handleOpenRecent}
        onOpenSettings={() => setScreen('settings')}
        onOpenVault={handlePickVault}
        theme={theme}
      />
    );
  })();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View style={styles.appShell}>
        {screenContent}
        {busyLabel ? <BusyOverlay label={busyLabel} theme={theme} /> : null}
        {notice ? <NoticeBar notice={notice} onClose={() => setNotice(null)} theme={theme} /> : null}
      </View>
    </SafeAreaView>
  );
}

function HomeScreen({
  noteName,
  recents,
  setNoteName,
  onCreateNote,
  onDailyNote,
  onOpenConvert,
  onOpenFile,
  onOpenRecent,
  onOpenSettings,
  onOpenVault,
  theme,
}: {
  noteName: string;
  recents: RecentFile[];
  setNoteName: (value: string) => void;
  onCreateNote: () => void;
  onDailyNote: () => void;
  onOpenConvert: () => void;
  onOpenFile: () => void;
  onOpenRecent: (file: RecentFile) => void;
  onOpenSettings: () => void;
  onOpenVault: () => void;
  theme: AppTheme;
}) {
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.pageContent}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.colors.muted }]}>Local-first</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Files</Text>
        </View>
        <SmallButton label="Settings" onPress={onOpenSettings} theme={theme} />
      </View>

      <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Open</Text>
        <ActionRow
          title="Open any file"
          subtitle="PDF, MD, TXT, DOCX, code, images, unknown files"
          onPress={onOpenFile}
          theme={theme}
        />
        <ActionRow
          title="Open folder / vault"
          subtitle="Obsidian-style folder browsing on Android"
          onPress={onOpenVault}
          theme={theme}
        />
        <ActionRow
          title="Convert"
          subtitle="Text, markdown, and code to PDF first"
          onPress={onOpenConvert}
          theme={theme}
        />
      </View>

      <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Markdown note</Text>
        <View style={styles.inlineForm}>
          <TextInput
            value={noteName}
            onChangeText={setNoteName}
            placeholder="Note name"
            placeholderTextColor={theme.colors.faint}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.input,
                borderColor: theme.colors.border,
              },
            ]}
          />
          <SmallButton label="Create" onPress={onCreateNote} theme={theme} />
        </View>
        <Pressable
          onPress={onDailyNote}
          style={({ pressed }) => [
            styles.dailyButton,
            { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.accentSoft },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>Open today&apos;s daily note</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent</Text>
        <Text style={[styles.metaText, { color: theme.colors.muted }]}>{recents.length} files</Text>
      </View>

      <View style={[styles.listPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        {recents.length === 0 ? (
          <EmptyState
            title="No recent files"
            body="Open a file or create a note. Everything stays local on your phone."
            theme={theme}
          />
        ) : (
          recents.map((file) => <FileRow key={`${file.uri}-${file.openedAt}`} file={file} onPress={() => onOpenRecent(file)} theme={theme} />)
        )}
      </View>
    </ScrollView>
  );
}

function ViewerScreen({
  activeFile,
  editorText,
  isEditing,
  markdownStats,
  matchCount,
  replaceAll,
  replaceOne,
  replaceTerm,
  searchTerm,
  setEditorText,
  setIsEditing,
  setReplaceTerm,
  setSearchTerm,
  vaultIndex,
  onBack,
  onExportPdf,
  onExportText,
  onOpenFile,
  onOpenExternal,
  onSave,
  onShare,
  theme,
}: {
  activeFile: AppFile;
  editorText: string;
  isEditing: boolean;
  markdownStats: { links: string[]; tags: string[]; backlinks: string[]; preview: string };
  matchCount: number;
  replaceAll: () => void;
  replaceOne: () => void;
  replaceTerm: string;
  searchTerm: string;
  setEditorText: (value: string) => void;
  setIsEditing: (value: boolean) => void;
  setReplaceTerm: (value: string) => void;
  setSearchTerm: (value: string) => void;
  vaultIndex: VaultIndex | null;
  onBack: () => void;
  onExportPdf: () => void;
  onExportText: (extension: 'txt' | 'md') => void;
  onOpenFile: (file: AppFile) => void;
  onOpenExternal: () => void;
  onSave: () => void;
  onShare: () => void;
  theme: AppTheme;
}) {
  const canEdit = activeFile.isEditable;

  return (
    <View style={styles.fill}>
      <TopBar title={activeFile.name} onBack={onBack} theme={theme}>
        {canEdit ? <SmallButton label={isEditing ? 'Preview' : 'Edit'} onPress={() => setIsEditing(!isEditing)} theme={theme} /> : null}
      </TopBar>

      <ScrollView style={styles.fill} contentContainerStyle={styles.viewerContent}>
        <View style={[styles.fileHero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.fileHeroTop}>
            <View style={[styles.fileIcon, { backgroundColor: theme.colors.accentSoft }]}> 
              <Text style={[styles.fileIconText, { color: theme.colors.text }]}>{activeFile.extension || activeFile.kind}</Text>
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.fileName, { color: theme.colors.text }]} numberOfLines={2}>
                {activeFile.name}
              </Text>
              <Text style={[styles.metaText, { color: theme.colors.muted }]}>
                {getKindLabel(activeFile.kind)} · {formatBytes(activeFile.size)}
              </Text>
            </View>
          </View>
          <Text style={[styles.helperText, { color: theme.colors.muted }]}>{getViewerHint(activeFile)}</Text>
          <View style={styles.toolbarWrap}>
            {canEdit ? <SmallButton label="Save" onPress={onSave} theme={theme} /> : null}
            {activeFile.isTextLike || activeFile.kind === 'docx' ? <SmallButton label="Export PDF" onPress={onExportPdf} theme={theme} /> : null}
            {activeFile.textContent || activeFile.isTextLike ? <SmallButton label="Export TXT" onPress={() => onExportText('txt')} theme={theme} /> : null}
            {activeFile.textContent || activeFile.isTextLike ? <SmallButton label="Export MD" onPress={() => onExportText('md')} theme={theme} /> : null}
            <SmallButton label="Share" onPress={onShare} theme={theme} />
            <SmallButton label="Open external" onPress={onOpenExternal} theme={theme} />
          </View>
        </View>

        {activeFile.isTextLike ? (
          <TextViewerEditor
            file={activeFile}
            editorText={editorText}
            isEditing={isEditing}
            markdownStats={markdownStats}
            matchCount={matchCount}
            replaceAll={replaceAll}
            replaceOne={replaceOne}
            replaceTerm={replaceTerm}
            searchTerm={searchTerm}
            setEditorText={setEditorText}
            setReplaceTerm={setReplaceTerm}
            setSearchTerm={setSearchTerm}
            vaultIndex={vaultIndex}
            onOpenFile={onOpenFile}
            theme={theme}
          />
        ) : (
          <RichPreview file={activeFile} theme={theme} />
        )}
      </ScrollView>
    </View>
  );
}

function TextViewerEditor({
  file,
  editorText,
  isEditing,
  markdownStats,
  matchCount,
  replaceAll,
  replaceOne,
  replaceTerm,
  searchTerm,
  setEditorText,
  setReplaceTerm,
  setSearchTerm,
  vaultIndex,
  onOpenFile,
  theme,
}: {
  file: AppFile;
  editorText: string;
  isEditing: boolean;
  markdownStats: { links: string[]; tags: string[]; backlinks: string[]; preview: string };
  matchCount: number;
  replaceAll: () => void;
  replaceOne: () => void;
  replaceTerm: string;
  searchTerm: string;
  setEditorText: (value: string) => void;
  setReplaceTerm: (value: string) => void;
  setSearchTerm: (value: string) => void;
  vaultIndex: VaultIndex | null;
  onOpenFile: (file: AppFile) => void;
  theme: AppTheme;
}) {
  return (
    <View style={styles.stack}>
      <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Find / replace</Text>
        <View style={styles.inlineForm}>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Find"
            placeholderTextColor={theme.colors.faint}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.input,
                borderColor: theme.colors.border,
              },
            ]}
          />
          <Text style={[styles.metaText, { color: theme.colors.muted }]}>{matchCount} matches</Text>
        </View>
        {isEditing ? (
          <View style={styles.inlineForm}>
            <TextInput
              value={replaceTerm}
              onChangeText={setReplaceTerm}
              placeholder="Replace with"
              placeholderTextColor={theme.colors.faint}
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.input,
                  borderColor: theme.colors.border,
                },
              ]}
            />
            <SmallButton label="One" onPress={replaceOne} theme={theme} />
            <SmallButton label="All" onPress={replaceAll} theme={theme} />
          </View>
        ) : null}
      </View>

      {file.readError ? (
        <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.bodyText, { color: theme.colors.danger }]}>{file.readError}</Text>
        </View>
      ) : null}

      {file.kind === 'markdown' && !isEditing ? (
        <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <MarkdownPreview content={editorText} theme={theme} />
          <Divider theme={theme} />
          <ObsidianInfo markdownStats={markdownStats} vaultIndex={vaultIndex} onOpenFile={onOpenFile} theme={theme} />
        </View>
      ) : isEditing ? (
        <TextInput
          value={editorText}
          onChangeText={setEditorText}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.editor,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
            file.kind === 'code' ? styles.monoText : null,
          ]}
        />
      ) : (
        <View style={[styles.readerBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.readerText, file.kind === 'code' ? styles.monoText : null, { color: theme.colors.text }]}>{editorText || 'Empty file'}</Text>
        </View>
      )}
    </View>
  );
}

function RichPreview({ file, theme }: { file: AppFile; theme: AppTheme }) {
  if (file.kind === 'pdf') {
    return <PdfPreview file={file} theme={theme} />;
  }

  if (file.kind === 'docx' && file.textContent) {
    return (
      <View style={[styles.readerBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>DOCX text preview</Text>
        <Text style={[styles.helperText, { color: theme.colors.muted, marginBottom: 10 }]}>Formatting is simplified; export/share uses extracted text.</Text>
        <Text style={[styles.readerText, { color: theme.colors.text }]}>{file.textContent}</Text>
      </View>
    );
  }

  if (file.kind === 'image') {
    return (
      <View style={[styles.imagePanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Image source={{ uri: file.uri }} resizeMode="contain" style={{ width: '100%', height: 420 }} />
      </View>
    );
  }

  return (
    <View style={[styles.panel, styles.centerPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <Text style={[styles.previewGlyph, { color: theme.colors.faint }]}>{file.extension || 'file'}</Text>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Drive-style preview shell</Text>
      {file.readError ? <Text style={[styles.bodyText, { color: theme.colors.danger, textAlign: 'center' }]}>{file.readError}</Text> : null}
      <Text style={[styles.bodyText, { color: theme.colors.muted, textAlign: 'center' }]}>
        This file is accepted by the app. Native preview modules for this type can plug into this screen without changing the rest of the app.
      </Text>
      <View style={styles.infoTable}>
        <InfoLine label="Kind" value={getKindLabel(file.kind)} theme={theme} />
        <InfoLine label="MIME" value={file.mimeType || 'Unknown'} theme={theme} />
        <InfoLine label="Size" value={formatBytes(file.size)} theme={theme} />
        <InfoLine label="URI" value={file.uri} theme={theme} />
      </View>
    </View>
  );
}

function ConvertScreen({
  activeFile,
  onBack,
  onExportPdf,
  onExportText,
  onPickFile,
  theme,
}: {
  activeFile: AppFile | null;
  onBack: () => void;
  onExportPdf: () => void;
  onExportText: (extension: 'txt' | 'md') => void;
  onPickFile: () => void;
  theme: AppTheme;
}) {
  return (
    <View style={styles.fill}>
      <TopBar title="Convert" onBack={onBack} theme={theme} />
      <ScrollView style={styles.fill} contentContainerStyle={styles.pageContent}>
        <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Current file</Text>
          {activeFile ? <FileRow file={activeFile} onPress={() => undefined} theme={theme} /> : <EmptyState title="No file selected" body="Open a file first or pick one now." theme={theme} />}
          <View style={styles.toolbarWrap}>
            <SmallButton label="Pick file" onPress={onPickFile} theme={theme} />
            <SmallButton label="Export PDF" onPress={onExportPdf} theme={theme} />
            <SmallButton label="Export TXT" onPress={() => onExportText('txt')} theme={theme} />
            <SmallButton label="Export MD" onPress={() => onExportText('md')} theme={theme} />
          </View>
        </View>
        <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Conversion roadmap</Text>
          <Bullet text="TXT / MD / code → PDF is wired first." theme={theme} />
          <Bullet text="PDF split/merge and annotations will be added as native PDF tools." theme={theme} />
          <Bullet text="DOCX preview and DOCX → text/markdown/PDF comes after PDF viewer stabilization." theme={theme} />
        </View>
      </ScrollView>
    </View>
  );
}

function VaultScreen({
  activeTag,
  files,
  index,
  query,
  setActiveTag,
  setQuery,
  uri,
  onBack,
  onOpenFile,
  onPickVault,
  theme,
}: {
  activeTag: string | null;
  files: AppFile[];
  index: VaultIndex | null;
  query: string;
  setActiveTag: (tag: string | null) => void;
  setQuery: (value: string) => void;
  uri: string | null;
  onBack: () => void;
  onOpenFile: (file: AppFile) => void;
  onPickVault: () => void;
  theme: AppTheme;
}) {
  const byQuery = filterVaultFiles(files, query, index?.notes ?? []);
  const visible = activeTag
    ? byQuery.filter((file) => index?.notes.some((note) => note.file.uri === file.uri && note.tags.includes(activeTag)))
    : byQuery;
  const visibleNotes = (index?.notes ?? []).filter((note) => visible.some((file) => file.uri === note.file.uri));

  return (
    <View style={styles.fill}>
      <TopBar title="Vault" onBack={onBack} theme={theme}>
        <SmallButton label="Change" onPress={onPickVault} theme={theme} />
      </TopBar>
      <ScrollView style={styles.fill} contentContainerStyle={styles.pageContent}>
        <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Obsidian-style folder</Text>
          <Text style={[styles.helperText, { color: theme.colors.muted }]} numberOfLines={3}>
            {uri || 'No folder selected'}
          </Text>
          <View style={styles.statGrid}>
            <StatBox label="Files" value={`${index?.fileCount ?? files.length}`} theme={theme} />
            <StatBox label="Notes" value={`${index?.notes.length ?? 0}`} theme={theme} />
            <StatBox label="Tags" value={`${index?.allTags.length ?? 0}`} theme={theme} />
            <StatBox label="Links" value={`${index?.linkCount ?? 0}`} theme={theme} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search file name, note text, tag, or wiki link"
            placeholderTextColor={theme.colors.faint}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.input,
                borderColor: theme.colors.border,
              },
            ]}
          />
          <View style={styles.pillWrap}>
            {activeTag ? <PillButton label="Clear tag" onPress={() => setActiveTag(null)} theme={theme} /> : null}
            {(index?.allTags ?? []).slice(0, 24).map((tag) => (
              <PillButton key={tag} label={`#${tag}`} onPress={() => setActiveTag(activeTag === tag ? null : tag)} selected={activeTag === tag} theme={theme} />
            ))}
          </View>
        </View>

        {visibleNotes.length ? (
          <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes index</Text>
            {visibleNotes.slice(0, 20).map((note) => (
              <Pressable
                key={note.file.uri}
                onPress={() => onOpenFile(note.file)}
                style={({ pressed }) => [styles.noteCard, { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.input, borderColor: theme.colors.border }]}
              >
                <Text style={[styles.actionTitle, { color: theme.colors.text }]}>{note.title}</Text>
                <Text style={[styles.helperText, { color: theme.colors.muted }]} numberOfLines={2}>{note.preview}</Text>
                <View style={styles.pillWrap}>
                  {note.tags.slice(0, 6).map((tag) => <Pill key={tag} label={`#${tag}`} theme={theme} />)}
                  {note.links.slice(0, 4).map((link) => <Pill key={link} label={`[[${link}]]`} theme={theme} />)}
                  {note.backlinks?.length ? <Pill label={`${note.backlinks.length} backlinks`} theme={theme} /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={[styles.listPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          {visible.length === 0 ? (
            <EmptyState title="No files here" body="Choose another folder, clear the tag, or clear the search." theme={theme} />
          ) : (
            visible.map((file) => <FileRow key={file.uri} file={file} onPress={() => onOpenFile(file)} theme={theme} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SettingsScreen({ onBack, theme }: { onBack: () => void; theme: AppTheme }) {
  return (
    <View style={styles.fill}>
      <TopBar title="Settings" onBack={onBack} theme={theme} />
      <ScrollView style={styles.fill} contentContainerStyle={styles.pageContent}>
        <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Defaults</Text>
          <InfoLine label="Storage" value="Local-first, no account, no cloud sync" theme={theme} />
          <InfoLine label="Open mode" value="Preview first, edit only when asked" theme={theme} />
          <InfoLine label="Open with" value="Android intent filters are configured for broad files" theme={theme} />
          <InfoLine label="UI" value="Minimal, file-manager style" theme={theme} />
        </View>
        <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Next modules</Text>
          <Bullet text="Native PDF page renderer with zoom/search/thumbnails." theme={theme} />
          <Bullet text="PDF annotations: highlight, text, signature, split, merge." theme={theme} />
          <Bullet text="DOCX text extraction and preview." theme={theme} />
          <Bullet text="Vault backlinks index and graph view." theme={theme} />
        </View>
      </ScrollView>
    </View>
  );
}

function MarkdownPreview({ content, theme }: { content: string; theme: AppTheme }) {
  const lines = content.split('\n');
  let inCode = false;

  return (
    <View style={styles.markdownBox}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('```')) {
          inCode = !inCode;
          return <Text key={index} style={[styles.codeFence, { color: theme.colors.faint }]}>```</Text>;
        }

        if (inCode) {
          return (
            <Text key={index} style={[styles.markdownCode, { color: theme.colors.text, backgroundColor: theme.colors.surfaceMuted }]}> 
              {line || ' '}
            </Text>
          );
        }

        if (line.startsWith('# ')) {
          return (
            <Text key={index} style={[styles.mdH1, { color: theme.colors.text }]}>
              {renderInline(line.replace(/^# /, ''), theme)}
            </Text>
          );
        }

        if (line.startsWith('## ')) {
          return (
            <Text key={index} style={[styles.mdH2, { color: theme.colors.text }]}>
              {renderInline(line.replace(/^## /, ''), theme)}
            </Text>
          );
        }

        if (line.startsWith('### ')) {
          return (
            <Text key={index} style={[styles.mdH3, { color: theme.colors.text }]}>
              {renderInline(line.replace(/^### /, ''), theme)}
            </Text>
          );
        }

        if (/^- \[[ xX]\]/.test(trimmed)) {
          const checked = /- \[[xX]\]/.test(trimmed);
          return (
            <Text key={index} style={[styles.mdParagraph, { color: theme.colors.text }]}> 
              {checked ? '☑' : '☐'} {renderInline(trimmed.replace(/^- \[[ xX]\]\s*/, ''), theme)}
            </Text>
          );
        }

        if (trimmed.startsWith('- ')) {
          return (
            <Text key={index} style={[styles.mdParagraph, { color: theme.colors.text }]}> 
              • {renderInline(trimmed.replace(/^-\s*/, ''), theme)}
            </Text>
          );
        }

        if (trimmed.startsWith('>')) {
          return (
            <Text key={index} style={[styles.blockQuote, { color: theme.colors.muted, borderLeftColor: theme.colors.border }]}> 
              {renderInline(trimmed.replace(/^>\s*/, ''), theme)}
            </Text>
          );
        }

        return (
          <Text key={index} style={[styles.mdParagraph, { color: theme.colors.text }]}> 
            {renderInline(line || ' ', theme)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(line: string, theme: AppTheme) {
  const regex = /(\[\[[^\]]+\]\]|#[A-Za-z0-9_/-]+)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line))) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));
    const token = match[0];
    nodes.push(
      <Text key={`${token}-${match.index}`} style={{ color: theme.colors.accent, fontWeight: '700' }}>
        {token}
      </Text>
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes.length ? nodes : line;
}

function ObsidianInfo({
  markdownStats,
  vaultIndex,
  onOpenFile,
  theme,
}: {
  markdownStats: { links: string[]; tags: string[]; backlinks: string[]; preview: string };
  vaultIndex: VaultIndex | null;
  onOpenFile: (file: AppFile) => void;
  theme: AppTheme;
}) {
  const findNote = (title: string) => vaultIndex?.notes.find((note) => note.title.toLowerCase() === title.toLowerCase());

  return (
    <View style={styles.stackSmall}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Note index</Text>
      <Text style={[styles.helperText, { color: theme.colors.muted }]}>{markdownStats.preview}</Text>

      <View style={styles.stackTiny}>
        <Text style={[styles.metaText, { color: theme.colors.muted }]}>Links</Text>
        <View style={styles.pillWrap}>
          {markdownStats.links.length ? (
            markdownStats.links.map((link) => {
              const note = findNote(link);
              return note ? (
                <PillButton key={link} label={`[[${link}]]`} onPress={() => onOpenFile(note.file)} theme={theme} />
              ) : (
                <Pill key={link} label={`[[${link}]]`} theme={theme} />
              );
            })
          ) : (
            <Text style={[styles.metaText, { color: theme.colors.faint }]}>No wiki links</Text>
          )}
        </View>
      </View>

      <PillGroup label="Tags" items={markdownStats.tags.map((tag) => `#${tag}`)} empty="No tags" theme={theme} />

      <View style={styles.stackTiny}>
        <Text style={[styles.metaText, { color: theme.colors.muted }]}>Backlinks</Text>
        <View style={styles.pillWrap}>
          {markdownStats.backlinks.length ? (
            markdownStats.backlinks.map((backlink) => {
              const note = findNote(backlink);
              return note ? (
                <PillButton key={backlink} label={backlink} onPress={() => onOpenFile(note.file)} theme={theme} />
              ) : (
                <Pill key={backlink} label={backlink} theme={theme} />
              );
            })
          ) : (
            <Text style={[styles.metaText, { color: theme.colors.faint }]}>No backlinks yet</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function PillGroup({ label, items, empty, theme }: { label: string; items: string[]; empty: string; theme: AppTheme }) {
  return (
    <View style={styles.stackTiny}>
      <Text style={[styles.metaText, { color: theme.colors.muted }]}>{label}</Text>
      <View style={styles.pillWrap}>
        {items.length ? (
          items.map((item) => <Pill key={item} label={item} theme={theme} />)
        ) : (
          <Text style={[styles.metaText, { color: theme.colors.faint }]}>{empty}</Text>
        )}
      </View>
    </View>
  );
}

function TopBar({ children, onBack, theme, title }: { children?: ReactNode; onBack: () => void; theme: AppTheme; title: string }) {
  return (
    <View style={[styles.topBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}> 
      <SmallButton label="Back" onPress={onBack} theme={theme} />
      <Text style={[styles.topBarTitle, { color: theme.colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.topBarActions}>{children}</View>
    </View>
  );
}

function ActionRow({ title, subtitle, onPress, theme }: { title: string; subtitle: string; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.flexOne}>
        <Text style={[styles.actionTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.actionSubtitle, { color: theme.colors.muted }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.chevron, { color: theme.colors.faint }]}>›</Text>
    </Pressable>
  );
}

function FileRow({ file, onPress, theme }: { file: RecentFile | AppFile; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fileRow,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={[styles.smallFileIcon, { backgroundColor: theme.colors.accentSoft }]}> 
        <Text style={[styles.smallFileIconText, { color: theme.colors.text }]}>{file.extension || file.kind.slice(0, 3)}</Text>
      </View>
      <View style={styles.flexOne}>
        <Text style={[styles.fileRowName, { color: theme.colors.text }]} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={[styles.metaText, { color: theme.colors.muted }]} numberOfLines={1}>
          {getKindLabel(file.kind)} · {formatBytes(file.size)}
        </Text>
      </View>
    </Pressable>
  );
}

function SmallButton({ label, onPress, theme }: { label: string; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.accentSoft,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.smallButtonText, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ label, theme }: { label: string; theme: AppTheme }) {
  return (
    <View style={[styles.pill, { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.border }]}> 
      <Text style={[styles.pillText, { color: theme.colors.text }]}>{label}</Text>
    </View>
  );
}

function PillButton({ label, onPress, selected, theme }: { label: string; onPress: () => void; selected?: boolean; theme: AppTheme }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: selected ? theme.colors.text : pressed ? theme.colors.surfaceMuted : theme.colors.accentSoft,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.pillText, { color: selected ? theme.colors.background : theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function StatBox({ label, value, theme }: { label: string; value: string; theme: AppTheme }) {
  return (
    <View style={[styles.statBox, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}> 
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.metaText, { color: theme.colors.muted }]}>{label}</Text>
    </View>
  );
}

function EmptyState({ body, theme, title }: { body: string; theme: AppTheme; title: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.bodyText, { color: theme.colors.muted, textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

function NoticeBar({ notice, onClose, theme }: { notice: NonNullable<Notice>; onClose: () => void; theme: AppTheme }) {
  const color = notice.tone === 'error' ? theme.colors.danger : notice.tone === 'success' ? theme.colors.success : theme.colors.text;
  return (
    <Pressable onPress={onClose} style={[styles.notice, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <Text style={[styles.noticeText, { color }]}>{notice.text}</Text>
    </Pressable>
  );
}

function BusyOverlay({ label, theme }: { label: string; theme: AppTheme }) {
  return (
    <View style={styles.busyBackdrop}>
      <View style={[styles.busyBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.bodyText, { color: theme.colors.text }]}>{label}…</Text>
      </View>
    </View>
  );
}

function InfoLine({ label, value, theme }: { label: string; value: string; theme: AppTheme }) {
  return (
    <View style={[styles.infoLine, { borderBottomColor: theme.colors.border }]}> 
      <Text style={[styles.infoLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.text }]} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

function Bullet({ text, theme }: { text: string; theme: AppTheme }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bodyText, { color: theme.colors.muted }]}>•</Text>
      <Text style={[styles.bodyText, { color: theme.colors.text, flex: 1 }]}>{text}</Text>
    </View>
  );
}

function Divider({ theme }: { theme: AppTheme }) {
  return <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  appShell: {
    flex: 1,
    position: 'relative',
  },
  fill: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  pageContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  viewerContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  listPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  chevron: {
    fontSize: 28,
    fontWeight: '300',
  },
  inlineForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    flexGrow: 1,
    minWidth: 70,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  noteCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 150,
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  dailyButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  topBar: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fileRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  smallFileIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallFileIconText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  fileRowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  fileHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  fileHeroTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  fileIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  fileName: {
    fontSize: 18,
    fontWeight: '800',
  },
  toolbarWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stack: {
    gap: 12,
  },
  stackSmall: {
    gap: 10,
  },
  stackTiny: {
    gap: 6,
  },
  readerBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    minHeight: 320,
  },
  readerText: {
    fontSize: 14,
    lineHeight: 21,
  },
  monoText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  editor: {
    minHeight: 420,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    lineHeight: 21,
  },
  markdownBox: {
    gap: 2,
  },
  mdH1: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 6,
  },
  mdH2: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  mdH3: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  mdParagraph: {
    fontSize: 15,
    lineHeight: 23,
  },
  blockQuote: {
    fontSize: 15,
    lineHeight: 23,
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginVertical: 3,
  },
  markdownCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codeFence: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  imagePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 360,
  },
  imagePreview: {
    width: '100%',
    height: 420,
  },
  centerPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
  },
  previewGlyph: {
    fontSize: 48,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoTable: {
    alignSelf: 'stretch',
    marginTop: 10,
  },
  infoLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    lineHeight: 19,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  emptyState: {
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  notice: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  noticeText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  busyBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  busyBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
});
