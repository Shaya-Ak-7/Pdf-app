# Pdf-app

Personal local-first mobile file viewer/editor/converter app.

Current direction:

- Obsidian-style markdown vault and notes
- Google-Drive-style universal file viewer
- Android-first APK target
- Local-first, no cloud account/sync
- Minimal practical UI
- Open-with/share support for broad file intake

## Current status

Implemented foundation plus the 70% MVP test build target features. Full-app completion is not 70% yet; after the latest PDF/DOCX/vault work it is closer to 50–55% of the larger full-app plan.

- Minimal mobile UI
- File picker and recent files
- Android broad `Open with` / `Share to` intent config
- Incoming share/open URL handling
- Markdown preview/edit
- Obsidian-like vault indexing: notes, tags, wiki links, backlinks
- Clickable wiki-link/backlink chips when a vault index exists
- Daily notes
- Text/code view/edit/find/replace/save
- Native PDF preview module for Android/iOS via `react-native-pdf`
- Web PDF iframe preview fallback
- PDF safe-copy tools: add text, extract page range, remove page, merge PDF
- DOCX text extraction/preview using DOCX XML parsing
- DOCX export from readable text
- Lightweight syntax-highlighted code preview
- Vault graph panel
- Image preview
- Unknown-file metadata fallback
- Export text/markdown/code/DOCX text to PDF
- Export readable text to TXT/MD/DOCX
- Native Android project generated with Expo prebuild

## Development

```bash
npm install
npm run web       # browser preview
npm run android   # Android dev client / emulator flow
npm run typecheck
```

## APK build

The project is APK-ready, but local APK generation needs a JDK and Android SDK.

```bash
npm run prebuild:android
npm run apk:debug
```

Output path after a successful local build:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
```

A Java 17 runtime has been installed in this sandbox through `jdk4py`, but Gradle/Android SDK downloads are currently blocked by TLS/network errors from the sandbox. `eas.json` is also configured for an internal APK build through EAS using the `preview` profile.

Planning document: [`docs/APP_PLAN.md`](docs/APP_PLAN.md)
