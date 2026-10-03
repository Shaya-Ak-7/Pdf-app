# Implementation Status

## Current milestone
Approximate completion: **70% MVP test build target**

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
- Native PDF preview module for Android/iOS using `react-native-pdf`.
- Web PDF preview fallback using iframe.
- DOCX text extraction and simplified preview via DOCX XML parsing.
- Image preview.
- Unsupported/unknown file fallback metadata screen.
- Native Android project generated using Expo prebuild.
- EAS config added for internal APK builds.

## Not fully complete yet
- Rich DOCX formatting edit like Microsoft Word.
- Adobe-style direct PDF text editing.
- PDF annotation tools: highlight, text insertion, signature.
- PDF split/merge/reorder/delete pages.
- Full graph view UI.
- Full Obsidian plugin compatibility.
- Polished APK icon/name after final app name is chosen.

## APK note
Local APK build was attempted with:

```bash
cd android && ./gradlew assembleDebug
```

It failed because this sandbox does not have Java installed:

```txt
JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

The project is configured for APK generation once Java + Android SDK or EAS Build authentication is available.
