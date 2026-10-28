# Implementation Status

## Current milestone
Approximate completion: **70% MVP test build target** and moving toward **full-app 70%**.

Important distinction:
- MVP 70% = testable personal-use build with core viewer/editor/converter/vault features.
- Full-app 70% = stronger PDF tools, conversion tools, vault graph, DOCX export, and more polished file workflows.

After the latest work, full-app completion is closer to **60–65%**, not 70% yet. Full-app 70% still needs deeper visual PDF annotation, richer DOCX formatting, batch conversion polish, and APK build validation.

## Completed
- Expo React Native + TypeScript app foundation.
- Minimal file-manager style UI.
- Local-first storage; no login/cloud sync.
- Recent files.
- File picker with broad `*/*` intake.
- Android intent filters for broad Open With / Share To.
- Incoming share payload handling.
- Incoming URL/file intent handling.
- Markdown note creation, preview, edit, save.
- Daily note creation.
- Text/code file preview and edit.
- Find, replace one, replace all.
- PDF export for text/markdown/code/DOCX extracted text.
- TXT/MD export for readable text.
- Obsidian-style vault folder selection on Android.
- Recursive vault scan with max depth/file safety limits.
- Vault index: note count, tags, wiki links, backlinks.
- Clickable wiki-link/backlink chips when linked note exists in vault.
- View-first Drive-style viewer (see `docs/DRIVE_PDF_VIEWER_ANALYSIS.md`): every intake source (system picker, Android "Open with"/share intents, recents, vault) opens files directly into a full-bleed read-only viewer. Editing and file tools are explicit app-bar actions, never the default surface.
- Native PDF preview module for Android/iOS using `react-native-pdf`: full-height canvas, continuous scroll, pinch zoom (0.5x–4x), bottom bar with prev/next, live `x / y` page indicator, and jump-to-page input.
- View-first readers: markdown → rendered preview; TXT → plain page reader; code → line-numbered highlighted reader; DOCX → extracted text on a page; image → contained full-bleed; unknown → metadata panel.
- Web PDF preview fallback using iframe (browser-native Drive-like chrome).
- PDF safe-copy tools using `pdf-lib`: add text to every page, highlight a page area, rotate page, extract page range, remove a page, move page to front/end, merge another PDF, and split pages to ZIP.
- DOCX text extraction and simplified preview via DOCX XML parsing.
- DOCX export from readable text/markdown/code/extracted DOCX text with basic headings, bullets, tasks, bold, and italic handling.
- Lightweight syntax-highlighted code preview.
- Vault graph panel with connected note nodes and edge list.
- Image preview.
- Image → PDF export.
- Unsupported/unknown file fallback metadata screen.
- Native Android project generated using Expo prebuild.
- EAS config added for internal APK builds.

## Not fully complete yet
- Rich DOCX formatting edit like Microsoft Word.
- Adobe-style direct PDF text editing.
- Advanced PDF annotation tools: highlight, drawing, signature, and visual placement.
- Polished PDF split/merge/reorder/delete page flows with thumbnails and page picker.
- Full interactive graph canvas UI.
- Full Obsidian plugin compatibility.
- Polished APK icon/name after final app name is chosen.

## APK note
Local APK build was attempted with:

```bash
cd android && ./gradlew assembleDebug
```

The first attempt failed because Java was missing. A Java 17 runtime was then installed through `jdk4py`, so `java -version` works. The build is still blocked because Gradle and Android SDK downloads fail in this sandbox with TLS/network errors:

```txt
javax.net.ssl.SSLHandshakeException: Remote host terminated the handshake
```

The project is configured for APK generation once Gradle + Android SDK can be downloaded, or when EAS Build authentication is available.
