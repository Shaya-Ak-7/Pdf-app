# APK Manual Test Plan — Personal File Tool

Android device-la APK test panna checklist. Ovvor test-kkum **Expected** epdi irukanum nu
kuduthurken. Test pannittu "OK / FAIL + note" appadiye ezhuthunga.

Score targets:
- **P0 items ellaam pass** aaganum (core promise: Open With → direct view).
- P1/P2 fail aana note pannunga, fix pannalam.

---

## A. Install & Launch (P0)

| # | Test | Expected result | Result |
|---|---|---|---|
| A1 | APK install (unknown sources allow panni) | Install error illaama aaganum | |
| A2 | App open | Splash → Home screen (Open file / Recents / Vault / Convert). Crash illa, freeze illa | |
| A3 | App close/re-open | Recents list save-ah irundhurukanum | |

## B. Open With / Share intake — CORE (P0)

| # | Test | Expected result | Result |
|---|---|---|---|
| B1 | Files/WhatsApp-la PDF tap → Open with | Namma app list-la theriyanum; select panna **direct full-screen viewer open aaganum** (periya settings/tools illa — content dhaan) | |
| B2 | Same with `.md` file | Direct viewer: rendered markdown (read-only by default) | |
| B3 | Same with `.txt` | Plain text page reader open aaganum | |
| B4 | Same with image (jpg/png) | Full-screen contained image | |
| B5 | Same with `.docx` | Extracted text page-a kaatanum | |
| B6 | Same with unknown file (`.zip`/`.bin`) | Crash illa — metadata panel + Share/Open external buttons matrum irukanum | |
| B7 | Share sheet → "Share to" namma app | Viewer screen-ku direct pogunum | |
| B8 | Home → "Open file" picker-la file choose | Same viewer open aaganum; Recents-la add aaganum | |

## C. PDF viewer (Drive-style) (P0)

| # | Test | Expected result | Result |
|---|---|---|---|
| C1 | Multi-page PDF open | Smooth vertical scroll; ellaa pages render aaganum | |
| C2 | Pinch zoom | 0.5x–4x varaikkum zoom; pan aaganum; crash illa | |
| C3 | Bottom page bar | `total` count sari-ah kaatanum; ‹ › buttons prev/next page move pannanum | |
| C4 | Jump-to-page | Number type panni Enter → direct andha page-ku pogunum; invalid number-la clamp (1 or last) | |
| C5 | App bar | Back arrow + file name + "PDF · size" subtitle theriyanum | |
| C6 | Back | Home-ku pogunum; file Recents-la irukanum | |

## D. Text / MD / code / DOCX / image (P0)

| # | Test | Expected result | Result |
|---|---|---|---|
| D1 | `.md` view | Headings/bold/bullets rendered-ah kaatanum (source illa, preview) | |
| D2 | Edit toggle (md/txt/code) | "Edit" appudina big text editor varanum; type panna mudiyanum; Save → file update aaganum | |
| D3 | `.txt` view | Plain page-look (white page, gray bg) | |
| D4 | Code file view | Line numbers + mono font + basic highlight | |
| D5 | Image | Center-la fill; pinch/scroll block illa | |
| D6 | Find (Tools tab) | Search term type panna match count kaatanum | |
| D7 | Replace (edit mode-la) | One/All replace work aaganum | |

## E. PDF tools (Tools tab) — P1

Ovvor tool-um **puthu copy** create panni Share sheet/notice kaatanum; original PDF change aagakudathu.

| # | Test | Expected result | Result |
|---|---|---|---|
| E1 | Add text stamp | Puthu PDF copy share-open; ellaa pages-la text stamp | |
| E2 | Highlight page | Copy-la highlight box | |
| E3 | Rotate / remove / move page | Copy-la page operations reflect aaganum | |
| E4 | Extract range | Start–end pages mattum existing-iru puthu PDF | |
| E5 | Merge PDF | Rendu PDFs-in pages combine aaganum | |
| E6 | Split ZIP | Ovvor page-um taniya PDF-ah ZIP copy | |

## F. Vault (P1)

| # | Test | Expected result | Result |
|---|---|---|---|
| F1 | "Open vault folder" | SAF permission + folder picker varanum; `.md` notes list aaganum | |
| F2 | Tags/wiki-links | Notes-la `#tag`, `[[link]]` irundha pills-ah kaatanum | |
| F3 | Daily note | Button-thotta puthu daily note create + open aaganum | |
| F4 | Backlinks | Note open panna backlinks section list aaganum | |

## G. General (P2)

| # | Test | Expected result | Result |
|---|---|---|---|
| G1 | Dark mode (system dark on panna) | Theme dark-ah maaranum; ellaa screens-la text readable | |
| G2 | Phone rotate | Content reflow; crash illa | |
| G3 | Open external | System chooser-la vera app open aaganum | |
| G4 | Share | Android share sheet varanum | |
| G5 | ~10MB+ PDF | Open aaganum; miga slow/crash illa | |
| G6 | Convert screen | Picked file-la export options varanum | |

---

## Report-back format (test pannitu ithu mathiri sollunga)

```
A1 OK / A2 OK / B1 FAIL (pdf open appum viewer varala, blank aachu) / ...
```
Screencast/screenshots important-a nice-to-have; FAIL items-ku device model + Android version sollunga.
