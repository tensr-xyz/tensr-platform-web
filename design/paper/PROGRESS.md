# Flow redesign progress

Read this file at the start of a session and continue from the first item that is not `wired`.

Status values: `todo` (not built from `screen.tsx`), `built` (in the app, not yet matched), `matched` (1440×900 screenshot matches `screen.png` apart from live data), `wired` (interactions in that artboard work while signed in).

Each folder should contain `screen.png` (Paper, 1x) and `screen.tsx` (Paper `get_jsx`, tailwind, `includeNodeIds` false). Build from `screen.tsx`, not from the PNG.

## Counts

- matched: 3
- wired: 3
- built: 1
- todo: 37
- checks done: 0 / 5

## Decisions

- New project creates an untitled project and opens it. The artboard has a button and a dashed card, and no name field.
- Fielding, live Qualtrics, Decipher, Alchemer, plugin ratings, and clips render as "coming soon". No sample completes.
- A project with files is "Active". A project with none is "Draft".
- Member marks use letters from the id. The first two characters of a uuid rendered as a number.
- Blank-equivalent answers are not themes. Shipped in API `aa126337`.
- A stack error returns its type and message. Shipped in API `aa126337`. Confirm the cars_EN save only after that deploy is live.
- Workspace label is the real organization name. The sidebar shows the part of that name after the email. The footer name is the part of the email before @. Initials come from that name.
- The folder plus creates a folder named "New folder". The artboard has no name field.
- Fielding cards use a coming-soon chip instead of a progress bar with sample completes.
- A finished chat shows the reply in the thread and a result panel. The sample chart, brand figures, and follow-up chips stay out until the reply contains them.

## Demo path

- [x] **1a Projects cards** (`68F-0`, `1a-projects-cards`) — **wired**. Sidebar icons, three-up cards, search, Cards/Table, and New project match the artboard apart from live names and the coming-soon chip. Search filters. Table view lists the same projects. `screen.tsx` keeps the layout classes; the icon paths stay in Paper.
- [x] **2 Chat** (`22B-0`, `2-chat`) — **wired**. Gray project frame, white card, chat rail, composer with Ask/Plan/Agent, and the output panel. A sent question shows as a bubble and the reply is meant for the panel. Fielding is a coming-soon chip. `screen.tsx` records the layout.
- [x] **2c Chat agent made an output** (`1EO8-0`, `2c-chat-output`) — **wired**. A finished reply shows the steps, the prose, and a result card in the thread. The right panel shows the lead, a key stat when the reply has one, and real downloads. Open goes to Tables. Add to report goes to Report. Save says when the run has no replayable steps. No sample chart.
- [ ] **4a Responses sheet** (`8EO-0`, `4a-responses`) — **todo**. PNG only. Needs the left rail, column mini-charts, stats row, and the Agent/Variable/Evidence panel.
- [ ] **4c Evidence** (`765-0`, `4c-evidence`) — **todo**. PNG only.
- [ ] **4d code frame** (`958-0`, `4d-code-frame`) — **todo**. PNG only.
- [ ] **4g Themes** (`16OA-0`, `4g-themes`) — **todo**. PNG only.
- [ ] **5 Tables** (`2LA-0`, `5-tables`) — **todo**. PNG only. Needs stub and banner chips, the table, and the agent thread.
- [ ] **6 Report** (`2ZC-0`, `6-report`) — **built**. Three deliverable cards wired to deck, banner book, and topline. No `screen.tsx` yet, not matched.

## Rest of the app

- [ ] **1b Projects table** (`6E7-0`, `1b-projects-table`) — **todo**. PNG only. The Cards/Table control exists.
- [ ] **1c Plugins** (`3IQ-0`, `1c-plugins`) — **todo**. PNG only.
- [ ] **1e Publish a plugin** (`1E37-0`, `1e-publish-plugin`) — **todo**. PNG only.
- [ ] **1d ⌘K palette** (`3IP-0`, `1d-command-palette`) — **todo**. PNG only. Enter opens setup. ⌘Enter sends the analysis name to chat.
- [ ] **2b Chat empty** (`1DY1-0`, `2b-chat-empty`) — **todo**. PNG only.
- [ ] **2d Project details** (`1F4C-0`, `2d-project-details`) — **todo**. PNG only.
- [ ] **3 Sources** (`288-0`, `3-sources`) — **todo**. PNG only.
- [ ] **3b Stack waves** (`93J-0`, `3b-stack-waves`) — **todo**. PNG only.
- [ ] **3c Interviews** (`17DV-0`, `3c-interviews`) — **todo**. PNG only.
- [ ] **4b Notebook** (`5ER-0`, `4b-notebook`) — **todo**. PNG only.
- [ ] **4e Weighting modal** (`97E-0`, `4e-weighting`) — **todo**. PNG only.
- [ ] **4f Run ANOVA modal** (`CJO-0`, `4f-anova`) — **todo**. PNG only.
- [ ] **5b Tables chart** (`1E0U-0`, `5b-tables-chart`) — **todo**. PNG only.
- [ ] **6b Report outputs** (`17SM-0`, `6b-report-outputs`) — **todo**. PNG only.
- [ ] **6c Output one-way ANOVA** (`1AYL-0`, `6c-anova-output`) — **todo**. PNG only.
- [ ] **6d Add to report** (`1C8L-0`, `6d-add-to-report`) — **todo**. PNG only.
- [ ] **6e Output comments** (`1E29-0`, `6e-comments`) — **todo**. PNG only.
- [ ] **6f Share modal** (`1E2H-0`, `6f-share`) — **todo**. PNG only.
- [ ] **6g Export a chart** (`1GZP-0`, `6g-export-chart`) — **todo**. PNG only.
- [ ] **6h Export a table** (`1HAU-0`, `6h-export-table`) — **todo**. PNG only.
- [ ] **6i Export report** (`1HPC-0`, `6i-export-report`) — **todo**. PNG only.

Skipped on purpose: Brand/logo boards, and 2e Clips. Clips stays a coming-soon tab.

## Site (PR #24, keep open)

- [ ] **0 Landing** (`2WD-0`, `0-landing`) — **todo**. PNG only. Rebuild in `tensr-landing-paper`.
- [ ] **0b Product** (`18A5-0`, `0b-product`) — **todo**. PNG only.
- [ ] **0c Integrations** (`1CX3-0`, `0c-integrations`) — **todo**. PNG only.
- [ ] **0d Agencies** (`17UM-0`, `0d-agencies`) — **todo**. PNG only.
- [ ] **0e Pricing** (`1BZU-0`, `0e-pricing`) — **todo**. PNG only.
- [ ] **0f Sign in** (`189B-0`, `0f-sign-in`) — **todo**. PNG only. Real Stytch. Check on localhost:3000 only.
- [ ] **0g Enter code** (`19KM-0`, `0g-enter-code`) — **todo**. PNG only.
- [ ] **0h Book a demo** (`1A3G-0`, `0h-book-demo`) — **todo**. PNG only.
- [ ] **0i Docs** (`1DTL-0`, `0i-docs`) — **todo**. PNG only.
- [ ] **0j Changelog** (`1DTM-0`, `0j-changelog`) — **todo**. PNG only.
- [ ] **0k Security** (`1DTN-0`, `0k-security`) — **todo**. PNG only.

## Checks (after dev is `aa126337` or later)

- [ ] Stack Save on cars_EN opens the stacked dataset with skip/override applied.
- [ ] Descriptives sent to chat finishes with a reply.
- [ ] Reapply shows the 409 "frame from another dataset" path in the UI.
- [ ] A table with a significant cell and a real respondent bitset shows the letter, and Evidence lists the verbatims.
- [ ] Part A on `af6696a8`, varied wording: weighted trust by market with `trend=previous_wave` and one download per file; unweighted Pearson chi-square with integer df; unweighted two-variable banner with value labels; three-group means as ANOVA. Never "stream ended without a result".

## Unfinished

- `scripts/strip_stored_nominal_nets.py` and `strip_signed_session_urls` were not run. No dev AWS credentials in this session.
