# Google Drive PDF Viewer — Behavioral Analysis & Implementation Spec

Methodology follows the installed `reverse-engineer-anything` (REA) skill: define the
target, state the evidence class, record observations with provenance, list
limitations and unknowns, then derive an implementation spec.

## 1. Target

- **Product:** Google Drive in-app file viewer (Android app + web), PDF preview mode.
- **Question:** What does the Drive PDF viewer UX consist of, so a local-first
  equivalent can be rebuilt in this app?
- **Evidence class:** *Behavioral / public-release evidence* — Google & press rollout
  documentation of the shipped viewer UI (Dec 2025 overhaul; Oct 2025 Android
  annotations release). No shipped APK artifact was available inside this build
  sandbox (package mirrors for proprietary APKs are both unreachable here and out
  of scope), so claims below are behavior-level, not decompiled code-level.

## 2. Observed behavior (public rollout evidence)

### 2.1 Viewer chrome (app bar)
- Full-screen, distraction-free viewing surface; document is the primary content.
- Top app bar: back arrow (left), file name as title, actions on the right
  (share / more-actions). One more tap via overflow reveals info & options.
- No oversized "file card" hero; metadata is secondary, not the main surface.

### 2.2 PDF navigation
- Vertical continuous page scroll with pinch-to-zoom (double-tap zoom support).
- Current page indicator ("x / y") visible; page-jump affordance to go directly
  to a page number.
- Web viewer (new UI): left sidebar with table of contents (when available) and
  per-page thumbnails for fast navigation.
- Toolbar exposes download, print, zoom in/out, and page navigation.

### 2.3 Annotation tools (Android, rolled out Oct 2025)
- Pen FAB bottom-right; tapping opens a bottom toolbar (phones) that can be
  dragged to the top; tablets use a side pill.
- Tools: pen (red/black/blue/green, 8–40px), highlighter (yellow/green/blue/purple),
  eraser (whole-stroke), undo/redo, hide-all-marks toggle.

### 2.4 Non-PDF view path
- Drive shows third-party formats (video, images, audio, docs) in the same
  view-first chrome: content centered, header minimal, actions (download/print
  /share) on toolbar.

### 2.5 Intake behavior
- Drive's own "Open with" / file tap goes straight into the viewer, in
  read-only mode by default. Editing is an explicit separate action
  (edit icon/FAB), never the default.

## 3. Limitations / unknowns

- **L1:** No APK artifact in sandbox → findings are UI-behavior level, not
  code-level (no class/method evidence). REA's `inspect_android_package` route
  was documented but not applicable without the artifact.
- **L2:** Thumbnail sidebar + TOC come from the **web** viewer overhaul; the
  Android viewer's navigation set is the subset implemented here (page
  indicator, jump-to-page, continuous scroll, zoom).
- **L3:** Text search inside PDF (Drive supports find-in-document) is not
  implementable with `react-native-pdf`; deferred (see gaps).

## 4. Derived spec for this app (view-first build)

Priority = **viewing completeness** from any intake source (system picker,
Android "Open with" / share intent, recents, vault). Default = read-only view;
tools/editing live one tap away, never blocking the read surface.

| Drive behavior | This app |
|---|---|
| App bar: back + file name + actions | Same: back arrow, title + `kind · size` subtitle, `Share`, `Tools`, `Edit` (editable only) |
| Full-bleed PDF surface | `PdfPreview` becomes flex-height full screen; fixed 560px frame removed |
| Page indicator `x / y` | Center chip in bottom bar |
| Jump to page | Numeric input in bottom bar + prev/next buttons |
| Pinch / double-tap zoom | already via `react-native-pdf` (0.75x–4x) |
| Annotation FAB (pen/highlight) | Existing safe-copy PDF tools (stamp/highlight/rotate…), moved into the **Tools** tab (writes produce a copy, never block viewing) |
| View-first for other formats | MD → rendered markdown; TXT/code → full-area reader; DOCX → extracted text reader; image → centered contained; unknown → metadata panel |
| Read-only default, edit explicit | `isEditing=false` always on open; Edit toggle in app bar |
| Overflow-style info | Tools tab carries kind/MIME/size/URI + exports + find/replace |

### Gaps tracked honestly (not in this pass)
- In-PDF text search (needs a text layer; pending library support).
- Page-thumbnail rail (web-Drive parity; needs PDF→image rasterization per page).
- Freehand ink annotation (Drive parity; current annotations are coordinate-based
  highlights/stamps via pdf-lib on a safe copy).
