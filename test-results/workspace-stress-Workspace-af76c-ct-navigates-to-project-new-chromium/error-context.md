# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workspace-stress.spec.ts >> Workspace stress — shell & navigation >> Project menu New Project navigates to /project/new
- Location: tests/workspace-stress.spec.ts:48:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('age', { exact: true }).first()
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 60000ms
  - waiting for getByText('age', { exact: true }).first()
    - waiting for" http://localhost:3000/login?returnTo=%2Fworkspace%2Fdataset%2Fe2e00000-0000-4000-8000-000000000001%3Fname%3De2e-sample.csv" navigation to finish...
    - navigated to "http://localhost:3000/login?returnTo=%2Fworkspace%2Fdataset%2Fe2e00000-0000-4000-8000-000000000001%3Fname%3De2e-sample.csv"

```

```yaml
- img "Tensr Logo"
- text: Welcome to Tensr The new way to analyse data
- button "Continue with Google" [disabled]:
    - img
    - text: Continue with Google
- button "Continue with GitHub" [disabled]:
    - img
    - text: Continue with GitHub
- text: OR Email
- textbox "Email" [disabled]:
    - /placeholder: Your email address
- button "Sending..." [disabled]
- link "Terms of Service":
    - /url: https://tensr-1.gitbook.io/tensr/legal-policies/terms-of-service
- text: and
- link "Privacy Policy":
    - /url: https://tensr-1.gitbook.io/tensr/legal-policies/privacy-policy
- region "Notifications (F8)":
    - list
```

```
Error: browserContext.close: Target page, context or browser has been closed
```
