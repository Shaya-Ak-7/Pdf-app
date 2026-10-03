# Personal File Viewer / Editor / Converter App — Plan

## Goal
Build a personal-use mobile app for Android first and iOS-compatible codebase later. The app should open, view, lightly edit, and convert common document/text/code files. It should also accept **almost any file** from Android's Open With / Share flow and handle unsupported files with a safe fallback view.

Temporary app name: **Pdf-app** / **Personal File Tool**. Final name will be decided later.

## Target Platforms
- Android: primary target, APK can be shared with friends.
- iOS: same codebase can support iOS, but installing on iPhone requires Apple-specific signing/TestFlight/Developer account or sideloading options.

## Core File Types
| Type | View | Edit | Convert |
|---|---:|---:|---:|
| Markdown `.md`, `.markdown` | Yes, preview + raw | Yes | MD ⇄ TXT/HTML, MD → PDF/DOCX |
| Text `.txt`, `.log`, `.csv` | Yes | Yes | TXT → PDF/MD/DOCX |
| Code `.js`, `.ts`, `.py`, `.java`, `.kt`, `.html`, `.css`, `.json`, `.xml`, `.yml`, etc. | Yes, syntax highlight | Small edits + find/replace | Code → TXT/PDF |
| PDF `.pdf` | Yes | Practical edits: annotate, highlight, add text, sign, merge/split/reorder/delete pages | PDF → TXT/images, PDF merge/split, TXT/MD → PDF |
| DOCX `.docx` | Yes | Text-level editing/import/export first; rich formatting later | DOCX ⇄ TXT/MD/PDF where feasible |
| Unknown/other files | Yes, intake + metadata + fallback | Only if safely detected as text | Basic rename/share/open externally; conversion only if detected/supported |

> Important reality check: full PDF text editing like Adobe Acrobat and full Word-level DOCX rich editing are complex. The first complete version should support reliable viewing, annotations, simple text extraction/editing, and conversions. Rich PDF/DOCX editing can be added after the core app is stable.

## Universal File Opening Strategy
The app should try to open more than only the listed file types. Android can expose the app in Open With / Share for broad file inputs, including `*/*`.

When a file comes in:
1. Detect by extension, MIME type, and file signature/magic bytes.
2. If it is a supported type, open the proper viewer/editor.
3. If MIME says unknown but content is readable text, open it in the text/code editor safely.
4. If it is binary/unsupported, show a clean fallback screen:
   - file name
   - extension/MIME
   - size
   - last modified date if available
   - actions: share, rename/copy, save as, open with another app
   - optional later: hex preview

This means the app can accept almost any file, but view/edit/convert quality depends on whether the format is actually supported or detectable.

## Must-Have Features
1. **Open With support**
   - Android intent filters for PDF, MD, TXT, DOCX, and common code extensions/MIME types.
   - App appears in Android “Open with” / “Share to” lists when a supported file is opened from Files, WhatsApp, Drive, browser downloads, etc.
   - iOS document types / share sheet support later.

2. **Home Screen**
   - Recent files
   - Open file button
   - Create new text/markdown/code file
   - Quick convert button
   - Local/external file locations

3. **Viewer / Editor**
   - Text/code editor with line numbers, syntax highlight, theme, undo/redo
   - Find and replace
   - Markdown raw edit + preview
   - PDF viewer with page navigation, zoom, search if possible
   - DOCX viewer via HTML/text rendering

4. **Conversion Center**
   - Choose input file
   - Show available output formats
   - Save converted file locally or share it
   - Batch conversion later

5. **Storage**
   - **Local-first only** for the main app. No account/login/cloud sync needed.
   - Open external files using Android/iOS system file picker.
   - Save as copy by default.
   - Overwrite original only if Android/iOS grants write permission.
   - Google Drive/OneDrive/iCloud files may still be selectable through the phone's system picker if those apps are installed, but the app itself does not need separate cloud features.
   - Real cloud sync/API integration is removed from MVP and can be skipped unless specifically needed later.

6. **Export / Share**
   - Save
   - Save as
   - Export to PDF/TXT/MD/DOCX where supported
   - Share file to other apps

7. **Settings**
   - Dark/light/system theme
   - Default open mode: viewer/editor
   - Recent files on/off
   - Default export folder
   - Clear cache

## UI Direction — Minimal, Human, Not AI-Looking
The UI must feel like a simple personal utility app, not a flashy AI-generated product.

Design rules:
- Minimal file-manager style layout.
- No unnecessary gradients, glassmorphism, huge cards, neon colors, or overdesigned hero sections.
- Mostly system colors: white/black/grey, with one simple accent color.
- Use native/system typography and spacing.
- Compact toolbar, clear file list, direct actions.
- Icons only where useful; no emoji-heavy UI.
- Smooth but subtle animations only.
- Offline/local-tool feeling.
- Practical screens over decorative screens.

Possible screen style:
- Home: recent files + open button + create button.
- Viewer: top bar with back, file name, search, menu.
- Editor: plain text area, line numbers optionally, bottom save status.
- Convert: simple input → output format → convert button.


## Obsidian-Style Knowledge Workspace
The app should not be only a generic file opener. It should also work like a local-first markdown knowledge app inspired by Obsidian.

Core Obsidian-like behavior:
- **Vaults/folders:** user can choose a folder as a vault and browse notes/files inside it.
- **Markdown-first notes:** `.md` files are first-class files with edit mode and preview mode.
- **Wiki links:** support `[[Note Name]]` links between notes.
- **Backlinks:** show which notes link to the current note.
- **Tags:** detect `#tag` and show tag-based browsing/search.
- **Search:** fast search by file name and inside note content.
- **Daily notes:** create/open today's note quickly.
- **Templates:** insert basic note templates later.
- **Attachments:** images, PDFs, DOCX, TXT, and code files can live inside the same vault/folder.
- **Graph view:** local note graph later after backlinks are stable.

Scope note: full Obsidian plugin ecosystem is not part of the first build. The goal is to provide the core personal markdown vault experience first, then add advanced features gradually.

## Google-Drive-Style Universal Viewer
The app should feel like Google Drive's PDF viewer, but for many file types: tap/open a file and see a clean preview first, with editing/conversion available from actions.

Universal viewer behavior:
- Viewer opens in **read-only preview mode by default**.
- Top bar: back, file name, search, more menu.
- Bottom/menu actions: edit, convert, share, save as, open externally, file info.
- Pinch zoom / scroll where relevant.
- Search inside supported text/PDF/DOCX files where possible.
- If a file is editable, user taps **Edit** to enter edit mode.
- If a file is unsupported, show a simple fallback preview screen with metadata and actions.

File-specific viewer targets:
- Markdown: rendered preview + edit toggle.
- TXT/log/code: readable viewer + edit toggle, syntax highlight for code.
- PDF: Drive-like page viewer, zoom, page jump, thumbnails/search when possible.
- DOCX: Drive-like document preview by rendering to text/HTML first.
- Images: simple image preview with zoom.
- Unknown files: metadata fallback + share/open externally.

## Recommended Tech Stack
Recommended: **React Native + TypeScript + Expo prebuild / Dev Client**

Why:
- One codebase for Android and iOS.
- Android APK build possible.
- Good UI ecosystem.
- Can add native Android intent filters for “Open with”.
- JavaScript libraries help with markdown, text/code editing, DOCX parsing, and PDF generation.

Possible libraries/modules:
- Navigation/UI: React Navigation, React Native Paper or Tamagui
- Files: Expo FileSystem, DocumentPicker, Sharing, native Android intent handler/custom module
- Database: SQLite for recent files and metadata
- Text/code editor: custom editor or WebView-based CodeMirror for syntax highlighting/find-replace
- Markdown: markdown parser + preview
- PDF view: native PDF viewer or PDF.js WebView
- PDF generation/edit: pdf-lib / native modules where needed
- DOCX: mammoth for DOCX → HTML/text, docx library for export

## App Architecture
```text
Incoming file/open-with/share
        ↓
File Intake Layer
        ↓
File Registry + Recent DB
        ↓
Viewer/Editor Router by file type
        ↓
Editor / PDF Viewer / DOCX Viewer / Markdown Preview
        ↓
Save / Save As / Convert / Share
```

## Build Phases
### Phase 1 — Foundation
- Create mobile project
- App shell, navigation, dark/light theme
- Home screen, recent files UI
- File picker
- Basic local file read/write

### Phase 2 — Text, Markdown, Code
- TXT/MD/code viewer/editor
- Syntax highlighting for code
- Find and replace
- Markdown preview
- Save/save as/share
- TXT/MD/code → PDF export

### Phase 3 — Android “Open with”
- Configure AndroidManifest intent filters
- Receive file URI from other apps
- Copy/cache/open files safely
- Register MIME types/extensions
- Test with Files, Drive, WhatsApp/downloads

### Phase 4 — PDF Support
- PDF viewer
- Page thumbnails/navigation
- PDF text extraction/search if feasible
- Add text/highlight/annotation/signature basics
- Merge/split/reorder/delete pages
- Export/share edited PDFs

### Phase 5 — DOCX Support
- DOCX viewer
- DOCX → text/markdown import
- Text-level editing
- Export edited content to DOCX/PDF
- Rich formatting later if needed

### Phase 6 — Universal File Fallback & Polish
- Accept broad `*/*` files from Android Open With / Share.
- Unknown file metadata screen.
- Text detection for extensionless/unknown files.
- Better error handling.
- Large file handling.
- Backup/restore settings locally.
- APK release build.

## “Open with” Answer
Yes, on Android the app can show in “Open with” for supported file types if we add proper intent filters. Users can also set it as default for those files.

For personal use, we can also register broad inputs like `*/*` so the app appears for almost any file. Trade-off: Android may show this app in many places even when the file is not really editable. That is acceptable if the app has a clean unsupported-file fallback screen.

On iOS, it can appear in the Share/Open In sheet for registered document types, but iOS behavior is more controlled than Android.

## Initial MVP Definition
A strong first complete build should include:
- Android app shell with minimal, practical UI
- Local-first file picker and file handling
- Open-with/share support for target files plus broad `*/*` intake
- Unknown file fallback screen
- View/edit TXT/MD/code
- Markdown preview
- Find/replace
- Export TXT/MD/code to PDF
- PDF viewer
- Recent files
- Save/share

Then add advanced PDF/DOCX conversion/editing iteratively.
