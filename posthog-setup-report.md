# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Tensr platform. It installed `posthog-js` (client-side) and `posthog-node` (server-side), wired up client initialization via `instrumentation-client.ts`, added a reverse proxy in `next.config.ts` to avoid ad-blocker interference, and created `src/lib/posthog-server.ts` for server-side event capture. User identification is called on every successful authentication so that client and server events are correlated to the same distinct ID. PostHog exception autocapture is enabled globally via `capture_exceptions: true`.

| Event name                      | Description                                                       | File                                                    |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| `login_initiated`               | User submits email to receive OTP verification code               | `src/components/templates/auth/login.tsx`               |
| `oauth_login_started`           | User clicks Google or GitHub OAuth button                         | `src/components/templates/auth/login.tsx`               |
| `user_signed_in`                | User successfully authenticates (OTP verified or OAuth completed) | `src/hooks/api/use-auth/index.tsx`                      |
| `user_signed_out`               | User explicitly logs out                                          | `src/hooks/api/use-auth/index.tsx`                      |
| `subscription_checkout_started` | User clicks a plan card and is redirected to Stripe checkout      | `src/components/templates/auth/subscription.tsx`        |
| `billing_interval_toggled`      | User switches between monthly and annual billing                  | `src/components/templates/auth/subscription.tsx`        |
| `subscription_cancelled`        | User confirms cancellation of active subscription                 | `src/components/templates/settings/billing.tsx`         |
| `plugin_purchased`              | User completes a plugin purchase                                  | `src/components/templates/plugin-purchase/index.tsx`    |
| `project_created`               | User creates a new project (blank or file upload)                 | `src/components/templates/project/new-project-form.tsx` |
| `team_member_invited`           | Admin sends invitation for a new team member                      | `src/components/templates/settings/members.tsx`         |
| `team_member_role_updated`      | Admin changes an existing team member's role                      | `src/components/templates/settings/members.tsx`         |
| `team_member_removed`           | Admin removes a member from the organisation                      | `src/components/templates/settings/members.tsx`         |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behaviour, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/523718/dashboard/1888298)
- [Subscription checkout funnel (wizard)](https://us.posthog.com/project/523718/insights/jmRT4Sqg)
- [Subscription checkouts by plan (wizard)](https://us.posthog.com/project/523718/insights/v5IhxHFu)
- [User sign-ins over time (wizard)](https://us.posthog.com/project/523718/insights/4V9uLU5C)
- [Projects created by type (wizard)](https://us.posthog.com/project/523718/insights/yAsL1NFz)
- [Team member invitations over time (wizard)](https://us.posthog.com/project/523718/insights/TU5OOK1T)

## Verify before merging

- [ ] Run `pnpm install` from the monorepo root (`/Users/oliverdarby/repos/tensr-repo/`) to install `posthog-js` and `posthog-node` — the sandbox prevented the wizard from running this command automatically.
- [ ] Run a full production build (`pnpm build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to any monorepo bootstrap scripts and share them with collaborators (they are already in `.env.example`).
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify in PostHog Error Tracking.
- [ ] Confirm the returning-visitor path also calls `identify` — `verifyAuth` identifies on fresh OTP login; check that OAuth returning users (session restored by `AuthProvider` on reload) also call `posthog.identify()` with their stored user ID.
- [ ] This project contains Stripe data. Run `npx @posthog/wizard warehouse` to connect Stripe as a PostHog data warehouse source and enrich analytics with revenue data.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
