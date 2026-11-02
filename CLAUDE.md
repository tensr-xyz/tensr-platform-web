# Tensr platform web

Follow `AGENTS.md`. It holds the git workflow for parallel agents and the assistant contract.

@AGENTS.md

## Standing rules

These come from the owner. Where they are stricter than `AGENTS.md`, these win.

### Merging and deploys

- One merge at a time. Wait for the deploy from one merge to finish before you queue the next.
- Do not merge while a `qa-lock` issue is open (`gh issue list --label qa-lock --state open`) or while a deploy is running (`gh run list` in `tensr-api` and here).
- Every PR includes the output of `pnpm test:fast`.
- Never dispatch prod. That means `deploy-prod` in `tensr-api` and any release to `main`.
- Do not run `eval:gate`, e2e, or smoke steps. Leave e2e to CI.

### Assistant code

- In `app/assistant/v2`, do not match on the user's text and do not hard-code column names from fixtures.

### Dev server

- Run the UI only on localhost:3000, never on another port.

### UI

- Use our shadcn components (`src/components/ui`), never native controls. See the component rules in `design/paper/PROGRESS.md`.
- Use font weights 400 and 500 only, unless that screen's Paper export uses another weight.
- One loading state per screen. Nothing pops in after the screen has drawn.
- Write copy in the customer's voice.
- Use "coming soon" only for things that need an outside partner, or a system we do not have yet.

### Working style

- Do not stop between tasks. Commit as you go, and report once at the end.
