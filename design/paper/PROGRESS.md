# Flow redesign progress

Read this file at the start of a session and continue from the first item that is not `wired`.

Status values: `todo` (not built from `screen.tsx`), `built` (in the app, not yet matched), `matched` (1440×900 screenshot matches `screen.png` apart from live data), `wired` (interactions in that artboard work while signed in).

Each folder should contain `screen.png` (Paper, 1x) and `screen.tsx` (Paper `get_jsx`, tailwind, `includeNodeIds` false). `screen.tsx` is the visual reference. Ship the shared components, not the Paper markup.

## Component rules

1. Use the shadcn components everywhere, never native controls. Map every control to its component: Select, Button, Input, Textarea, Checkbox, Switch, RadioGroup, Tabs, Dialog (all modals), Sheet (side panels), DropdownMenu, Popover, Command (the ⌘K palette), Tooltip, Badge (status pills and the coming-soon chip), Avatar (member marks), Card, Table, ScrollArea, Separator, Skeleton (loading). No `<select>`, native checkbox or radio, or unstyled `<input>` / `<button>` in app code.
2. The Paper tokens are the shadcn variables in `src/app/globals.css`: background/foreground are canvas/ink, muted is well/muted, border/input is line, primary is accent, accent is accent-soft, destructive is the red, warn is `#A15C12`, radius is 6/10/16, font is Suisse Intl then Inter. Sizes, padding, and focus rings are set in `src/components/ui`, not in each screen.
3. Where Paper shows something those components do not cover (stub/banner chips, the segmented Sheet/Notebook/Themes switch, mini column charts, sig-letter cells), build it once in `components/ui` or `components/flow`, composed from the primitives, and reuse it. `Segmented` is that switch.
4. A screen is not done while its components status is `native`.
5. `src/components/flow/native-controls.test.ts` and the eslint rule on `src/components/flow` and `src/app/flow` fail on native `<select>`, `<button>`, `<textarea>`, `<input>`, checkbox, and radio. The primitives in `components/ui` (and the atoms and molecules they wrap) are the only place those elements belong.
6. One loading state until the screen's main data is ready. Use `Skeleton` in the final layout (project cards, sheet rows, a table, a rail) or one centred spinner for a whole page. Projects renders the card grid, including the New project card, only after the list has loaded. An error or an empty list replaces that grid. It does not sit beside a half-drawn one.
7. Type is regular (400) and medium (500): `--weight-regular` and `--weight-medium` on `.flow`. A heavier weight is only where that screen's `screen.tsx` uses it. Paper titles, figures, and initials use 600, which is `--weight-title`. `font-semibold` and `font-bold` fail `native-controls.test.ts` unless the file is on the allowlist for a screen whose export uses that weight.

## Counts

- matched: 9
- wired: 9
- built: 0
- todo: 32
- checks done: 6 passed, 1 owner QA

## Decisions

- New project creates an untitled project and opens it. The artboard has a button and a dashed card, and no name field.
- Fielding, live Qualtrics, Decipher, Alchemer, plugin ratings, and clips render as "coming soon". No sample completes.
- A project with files is "Active". A project with none is "Draft".
- Member marks use letters from the id. The first two characters of a uuid rendered as a number.
- Blank-equivalent answers are not themes. Shipped in API `aa126337`.
- A stack error returns its type and message. Shipped in API `aa126337`. Repeated row ids are rewritten on the fuse path in API `557505d`, live at 2026-11-02T10:50:33Z. The cars_EN save opened a 30-row file with `region_market` and without `Q7_coding`.
- Workspace label is the real organization name. The sidebar shows the part of that name after the email. The footer name is the part of the email before @. Initials come from that name.
- The folder plus creates a folder named "New folder". The artboard has no name field.
- Fielding cards use a coming-soon chip instead of a progress bar with sample completes.
- A finished chat shows the reply in the thread and a result panel. The sample chart, brand figures, and follow-up chips stay out until the reply contains them.
- The Paper tokens are the shared theme in globals.css, so the classic workspace uses the same colours. Control sizes for the redesign live in components/ui.
- Response column charts and the variable panel count the loaded page. They are not weighted population figures. Labels and Values stay off this toolbar because the preview cells are already the stored values. Weight, ANOVA, and Descriptives stay on the toolbar so those flows remain reachable.
- Add to project moves a dataset into the current project. A dataset has one project, so files from different projects can be stacked only after the move. The dataset menu has Move to project. An explicit move sets `project_placement` so a later derived write does not snap the file back to its old study. Shipped in API `04da3c2`, live at 2026-11-02T11:44:14Z.
- A single-code evidence quote shows the value label. A coded open end quotes the source column, so the text stays the verbatim. When a stack dropped the sav labels, the quote reads them from the parent and origin files. Shipped in API `f1ff346`, live at 2026-11-02T12:08:54Z.

## Demo path

- [x] **1a Projects cards** (`68F-0`, `1a-projects-cards`) — **wired**. Sidebar icons, three-up cards, search, Cards/Table, and New project match the artboard apart from live names and the coming-soon chip. Search filters. Table view lists the same projects. `screen.tsx` keeps the layout classes; the icon paths stay in Paper. Components: shadcn.
- [x] **2 Chat** (`22B-0`, `2-chat`) — **wired**. Gray project frame, white card, chat rail, composer with Ask/Plan/Agent, and the output panel. A sent question shows as a bubble and the reply is meant for the panel. Fielding is a coming-soon chip. `screen.tsx` records the layout. Components: shadcn.
- [x] **2c Chat agent made an output** (`1EO8-0`, `2c-chat-output`) — **wired**. A finished reply shows the steps, the prose, and a result card in the thread. The right panel shows the lead, a key stat when the reply has one, and real downloads. Open goes to Tables. Add to report goes to Report. Save says when the run has no replayable steps. No sample chart. Components: shadcn.
- [x] **4a Responses sheet** (`8EO-0`, `4a-responses`) — **wired**. Three columns: project rail, sheet with column mini-charts from the loaded page, and Agent/Variable/Evidence. Search filters column names, or rows when no column matches. Clicking a code filters that column. A row number selects the row. Sheet, Notebook, and Themes switch the center. Weight, ANOVA, and Descriptives stay on the toolbar. `screen.tsx` is the Paper export. Components: shadcn.
- [x] **4c Evidence** (`765-0`, `4c-evidence`) — **wired**. Opening a significant cell shows the evidence chip, highlights those rows and the column, and lists the value labels. Back to all clears it. See all scrolls the sheet. Open table and Cite in report leave the screen. The letter chip is the letter the cell carries. Labels and Values stay off the toolbar. `screen.tsx` is the Paper export. Components: shadcn.
- [x] **4d code frame** (`958-0`, `4d-code-frame`) — **wired**. A coded column opens the theme list in the variable rail. Counts and the uncoded row are the loaded page. See all filters the sheet. Selecting a theme shows Merge and Clear. Use as banner opens Tables. The live Q7 frame is one theme, so Merge stays off. PNG is the reference. Components: shadcn.
- [x] **4g Themes** (`16OA-0`, `4g-themes`) — **wired**. Themes runs the column as a column-% table with a split-by chip. The base sits under the themes. A cell opens Evidence and stays on Themes. Edit code frame opens the variable rail. The uncoded count is the table's not-coded figure. No agent-read sentence is invented. `screen.tsx` is the Paper export. Components: shadcn.
- [x] **5 Tables** (`2LA-0`, `5-tables`) — **wired**. Stub and banner chips, the saved-table list, and a column-% table. The base sits at the end. Sig letters and the low-base mark are toggles. Save stores the table. A cell opens Evidence on Responses. The side thread records the run and does not invent a finding. Chart says the chart view is the next screen. `screen.tsx` is the Paper export. Components: shadcn.
- [x] **6 Report** (`2ZC-0`, `6-report`) — **wired**. White report card, Overview menu, and the three deliverable cards. The title is the project name. The meta line is the saved-table count and fielding coming soon. Key findings stay empty until a report has written findings. Client deck download returned a file. Filter, Segments, and Edit are on the toolbar and do not apply a cut. `screen.tsx` is the Paper export. Components: shadcn.

## Rest of the app

- [ ] **1b Projects table** (`6E7-0`, `1b-projects-table`) — **todo**. PNG only. The Cards/Table control exists. Components: shadcn.
- [ ] **1c Plugins** (`3IQ-0`, `1c-plugins`) — **todo**. PNG only. Components: shadcn.
- [ ] **1e Publish a plugin** (`1E37-0`, `1e-publish-plugin`) — **todo**. PNG only. Components: shadcn.
- [ ] **1d ⌘K palette** (`3IP-0`, `1d-command-palette`) — **todo**. PNG only. Enter opens setup. ⌘Enter sends the analysis name to chat. Components: shadcn.
- [ ] **2b Chat empty** (`1DY1-0`, `2b-chat-empty`) — **todo**. PNG only. Components: shadcn.
- [ ] **2d Project details** (`1F4C-0`, `2d-project-details`) — **todo**. PNG only. Components: shadcn.
- [ ] **3 Sources** (`288-0`, `3-sources`) — **todo**. PNG only. Components: shadcn.
- [ ] **3b Stack waves** (`93J-0`, `3b-stack-waves`) — **todo**. PNG only. Components: shadcn.
- [ ] **3c Interviews** (`17DV-0`, `3c-interviews`) — **todo**. PNG only. Components: shadcn.
- [ ] **4b Notebook** (`5ER-0`, `4b-notebook`) — **todo**. PNG only. Components: shadcn.
- [ ] **4e Weighting modal** (`97E-0`, `4e-weighting`) — **todo**. PNG only. Components: shadcn.
- [ ] **4f Run ANOVA modal** (`CJO-0`, `4f-anova`) — **todo**. PNG only. Components: shadcn.
- [ ] **5b Tables chart** (`1E0U-0`, `5b-tables-chart`) — **todo**. PNG only. Components: shadcn.
- [ ] **6b Report outputs** (`17SM-0`, `6b-report-outputs`) — **todo**. PNG only. Components: shadcn.
- [ ] **6c Output one-way ANOVA** (`1AYL-0`, `6c-anova-output`) — **todo**. PNG only. Components: shadcn.
- [ ] **6d Add to report** (`1C8L-0`, `6d-add-to-report`) — **todo**. PNG only. Components: shadcn.
- [ ] **6e Output comments** (`1E29-0`, `6e-comments`) — **todo**. PNG only. Components: shadcn.
- [ ] **6f Share modal** (`1E2H-0`, `6f-share`) — **todo**. PNG only. Components: shadcn.
- [ ] **6g Export a chart** (`1GZP-0`, `6g-export-chart`) — **todo**. PNG only. Components: shadcn.
- [ ] **6h Export a table** (`1HAU-0`, `6h-export-table`) — **todo**. PNG only. Components: shadcn.
- [ ] **6i Export report** (`1HPC-0`, `6i-export-report`) — **todo**. PNG only. Components: shadcn.

Skipped on purpose: Brand/logo boards, and 2e Clips. Clips stays a coming-soon tab.

## Site (PR #24, keep open)

- [ ] **0 Landing** (`2WD-0`, `0-landing`) — **todo**. PNG only. Rebuild in `tensr-landing-paper`. Components: native.
- [ ] **0b Product** (`18A5-0`, `0b-product`) — **todo**. PNG only. Components: native.
- [ ] **0c Integrations** (`1CX3-0`, `0c-integrations`) — **todo**. PNG only. Components: native.
- [ ] **0d Agencies** (`17UM-0`, `0d-agencies`) — **todo**. PNG only. Components: native.
- [ ] **0e Pricing** (`1BZU-0`, `0e-pricing`) — **todo**. PNG only. Components: native.
- [ ] **0f Sign in** (`189B-0`, `0f-sign-in`) — **todo**. PNG only. Real Stytch. Check on localhost:3000 only. Components: native.
- [ ] **0g Enter code** (`19KM-0`, `0g-enter-code`) — **todo**. PNG only. Components: native.
- [ ] **0h Book a demo** (`1A3G-0`, `0h-book-demo`) — **todo**. PNG only. Components: native.
- [ ] **0i Docs** (`1DTL-0`, `0i-docs`) — **todo**. PNG only. Components: native.
- [ ] **0j Changelog** (`1DTM-0`, `0j-changelog`) — **todo**. PNG only. Components: native.
- [ ] **0k Security** (`1DTN-0`, `0k-security`) — **todo**. PNG only. Components: native.

## Checks (after dev is `aa126337` or later)

- [x] Stack Save on cars_EN opens the stacked dataset with skip/override applied. On dev `557505d` (live 2026-11-02T10:50:33Z): both cars_EN files, skip `Q7_coding`, override `region` to `region_market`. Opened the responses sheet, 30 respondents, `region_market` present, `Q7_coding` absent. The earlier save on `aa126337` returned `RowUidIntegrityError: non_unique`.
- [x] Descriptives sent to chat finishes with a reply. Agent mode, cars_EN: means for aware_A 0.8 (base 20), owns_A 0.6 (base 20), likes_A 3.438 (base 16), Q7 3 (base 20). No "stream ended".
- [x] Reapply shows the 409 path in the UI. Interviews, column Q7, source the other cars_EN.sav: "That file has no saved code frame. Pick the dataset in this project that has one." The dropdown listed cars_EN.sav.
- [x] A table with a significant cell and a real respondent bitset shows the letter, and Evidence lists the verbatims. On dev `c390967` (live 2026-11-02T11:10:46Z), aware_A by owns_A on the stacked file showed `100.0% A` and `50.0% B`. Evidence listed 18 respondents. Before that deploy the same letter had no bitset (`unknown_row_uids`, 6 of 12). On dev `f1ff346` (live 2026-11-02T12:08:54Z) those 18 quotes read Yes, the sav label for code 1, instead of the stored `1.0`.
- [x] Add to project moves an existing dataset into the project, and the dataset menu has Move to project. On dev `04da3c2` (live 2026-11-02T11:44:14Z), cars_DE.sav moved into cars_EN. Sources then listed 3 files, and the stack list included cars_DE.sav. The classic dataset menu opens the same dialog and was cancelled without a second move.
- [x] Part A on `af6696a8` — **owner QA**. Weighted trust by market with `trend=previous_wave` and one download per file; unweighted Pearson chi-square with integer df; unweighted two-variable banner with value labels; three-group means as ANOVA. Never "stream ended without a result". Left for the owner. `af6696a8` is not in the test user's account, so this session did not run it and did not answer the open trust clarification.
- [x] likert_openends `comments` (a real open end). Haiku coding on project `9065b0ef`, derived dataset `74bac240`. Interviews proposed 11 themes. Themes of Codes for comments by region: East, North, West, South. "Base: answered 348 of 400". 42 not coded. The East 16.0% cell (Price too high / poor value, n 13, base 81) quotes `comments`: 13 verbatims, respondent ids 7, 11, 20 and the rest, including "Too expensive for what you get". The panel had drawn that count as 0 while the request was still running, and the sheet matched those ids against `_row_uid`, so See all marked no rows. The count now waits for the request, and the sheet matches the survey id as well as `_row_uid`. Column letters were requested and no cell showed a letter. East 16.0% (13/81) against North 7.5% (6/80) is not a 95% difference. `test_coded_open_end_cell_lists_source_verbatims_and_tests_the_theme_row` shows the test does run on a theme row: an extreme split gets a letter, and a tied split is tested and gets none. Shipped in API `929b12f`, live at 2026-11-02T13:48:59Z. Deploy-prod was skipped.

## Bugs found

- The dataset select on Responses logs that it changes from uncontrolled to controlled. It does not block the sheet.
- The code frame offers numeric columns. Q7 got a "Numeric only, no comment" theme. Only text open-end columns should be codeable. Theme evidence for that frame quotes Q7 and returns no verbatims.
- A themes banner heading shows the stored code (region 1 and 2) rather than the value label. On likert_openends the region values are already words, so the headings read East, North, West, South.
- The "No substantive comment" theme shows a count of 37 beside a total of 1.7%. The other ten theme counts match their column percents of the 348 base.
- agree_value by region saved Top 2 and Bottom 2 rows at 0% while those toggles were off. The table request did not ask for them.

## Unfinished

- `scripts/strip_stored_nominal_nets.py` and `strip_signed_session_urls` were not run. No dev AWS credentials in this session.
