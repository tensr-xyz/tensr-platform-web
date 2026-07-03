# Staging billing validation

Run this checklist on a **staging** environment with Stripe **test mode** before production launch.

> **Launch gate (item 8):** Subscription checkout is validated manually here — not in `pnpm test:launch`. Automated Stripe E2E is descoped because it requires Stytch + Stripe test secrets and a deployed API webhook; duplicating that in CI is brittle. After staging sign-off, treat this doc as the billing release record.

## Setup

1. Deploy `tensr-api` with Stripe test secret key and webhook endpoint configured.
2. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the matching **test** publishable key on platform-web.
3. Configure Stytch test project for the staging domain.

## Manual test flow

| Step | Action                                                               | Expected                                                  |
| ---- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Create a new account (no subscription)                               | Lands on `/dashboard`                                     |
| 2    | Trigger a paywalled feature (e.g. AI assistant on a restricted plan) | Redirect or message to `/subscription`                    |
| 3    | Complete checkout with `4242 4242 4242 4242`                         | Returns to app with active subscription                   |
| 4    | Open `/settings/billing`                                             | Plan name, renewal date, invoice list correct             |
| 5    | Cancel via billing portal                                            | Access continues until period end                         |
| 6    | Stripe webhook dashboard                                             | `invoice.paid`, `customer.subscription.updated` delivered |

## Webhook events to verify

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `invoice.paid`

## Production cutover

- Replace Stripe keys with **live** keys
- Replace Stytch token with **production** project
- Re-run steps 1–4 with a real payment method in a controlled test account
