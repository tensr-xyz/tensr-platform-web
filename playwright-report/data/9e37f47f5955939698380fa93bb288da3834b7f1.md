# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: analyze-menu.spec.ts >> Analyze command palette >> lists only production analysis items and none open the unavailable dialog
- Location: tests/analyze-menu.spec.ts:78:7

# Error details

```
Error: browserType.launch: Executable doesn't exist at /var/folders/t7/x0mhb4td5nd7nt92r7n0_5t00000gn/T/cursor-sandbox-cache/d1a3a76598eb740e98e13664c6b07be2/playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```
