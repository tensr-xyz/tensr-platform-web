# Launch test scope

`pnpm test:launch` (from repo root) runs:

1. **tensr-api** — full `pytest` suite
2. **tensr-platform-web** — Jest unit tests + Playwright launch config

## Playwright (launch)

Included (`playwright.launch.config.ts`):

- `analysis-descriptives.spec.ts` — dataset workspace → Descriptives → report
- `analyze-menu.spec.ts` — production Analyze/Data palette
- `agent-chat.spec.ts` — workspace route smoke

## Manual QA (prod)

- [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md) — full prod run sheet (Phases 0–9)
- [DATA_TRANSFORM_PO_GUIDE.md](./DATA_TRANSFORM_PO_GUIDE.md) — Data & Transform menu guide for PO sign-off

`agent-api.spec.ts` and `agent-system.spec.ts` remain in the full Playwright suite but are **excluded from launch**: they are placeholder `expect()` checks that do not exercise the UI (kept for future agent utility coverage, not launch gates).

## Playwright (descoped — not in launch gate)

| Spec                                     | Decision                 | Reason                                                                                                                                                                               |
| ---------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collaboration.spec.ts`                  | **Removed**              | Not in launch gate yet; restore when collaboration E2E is stable against tensr-api WebSockets.                                                                                       |
| `integration/multi-file-project.spec.ts` | **Removed**              | Multi-file zip import picker is off at launch (`NEXT_PUBLIC_MULTI_FILE_PROJECTS_ENABLED` unset). Workspace imports the first file only.                                              |
| `plugin-marketplace.spec.ts`             | **Removed**              | Marketplace browse/install is manual QA; creator (`/creator`) and analytics plugin routes are not launch-critical. Plugins nav remains for browse/install with mocked/empty catalog. |
| `auth.spec.ts`                           | **Ignored** (full suite) | Requires real Stytch; covered by `playwright.auth.config.ts` in full `pnpm test`.                                                                                                    |

## Jest

All `*.test.ts(x)` under `tests/` and `src/` run in launch gate. `file-selector.test.tsx` matches the current `FileSelector` component.

## Billing (item 8)

Stripe subscription E2E is **not automated**. Use [STAGING_BILLING.md](./STAGING_BILLING.md) manual checklist on staging with Stripe test mode before production.

## Org settings (item 9)

`/settings/general`, `/settings/members`, and `/settings/organisation` are implemented and linked from Settings nav. No separate “General/Members” stubs to hide.
