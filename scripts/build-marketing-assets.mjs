#!/usr/bin/env node
/**
 * Builds 1:1 marketing assets from Tensr-landing/site HTML + CSS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const SRC = path.join(REPO, 'Tensr-landing/site');
const OUT = path.resolve(__dirname, '../src/components/templates/marketing/content');
const STYLES = path.resolve(__dirname, '../src/styles/marketing');

const APP_URL = 'https://app.tensr.xyz';

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function patchHtml(html) {
  let out = html
    .replace(/\bhref="#contact-sales"/g, 'href="/enterprise"')
    .replace(/class="btn btn-dark" href="#"/g, 'class="btn btn-dark" href="/enterprise"')
    .replace(/\bhref="#"/g, `href="${APP_URL}"`)
    .replace(/\bhref="Home\.html"/g, 'href="/"')
    .replace(/\bhref="Features\.html"/g, 'href="/features"')
    .replace(/\bhref="Pricing\.html"/g, 'href="/pricing"');
  out = out.replace(
    /<a class="btn btn-lg" href="https:\/\/app\.tensr\.xyz" style="background:transparent; color:#fff; border-color:var\(--dark-line\);">Talk to sales/g,
    '<a class="btn btn-lg" href="/enterprise" style="background:transparent; color:#fff; border-color:var(--dark-line);">Talk to sales'
  );
  return stripComments(out);
}

function extractBetween(source, startTag, endTag) {
  const start = source.indexOf(startTag);
  if (start === -1) return '';
  const from = start + startTag.length;
  const end = source.indexOf(endTag, from);
  return source.slice(from, end).trim();
}

function extractStyleBlock(source) {
  const m = source.match(/<style>([\s\S]*?)<\/style>/i);
  return m ? m[1].trim() : '';
}

/** Scope landing CSS to .tensr-marketing without rewriting every rule. */
function scopeSiteCss(css) {
  let out = css;
  out = out.replace(/:root\s*\{/g, '.tensr-marketing {');
  out = out.replace(/\bbody\s*\{/g, '.tensr-marketing {');
  out = out.replace(/\bbody\[/g, '.tensr-marketing[');
  out = out.replace(
    /^\*, \*::before, \*::after/m,
    '.tensr-marketing, .tensr-marketing *::before, .tensr-marketing *::after'
  );

  const elementGroups = [
    'h1, h2, h3, h4',
    'p',
    'a',
    'img, svg',
    'button, input, textarea, select',
    'button',
  ];
  for (const sel of elementGroups) {
    const re = new RegExp(`^${sel.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')} \\{`, 'm');
    out = out.replace(re, `.tensr-marketing ${sel} {`);
  }

  // Beat Tailwind utilities that share class names (.gap-3, .mt-5, etc.)
  out = out.replace(
    /^(\.(?:gap|mt|row|col|center|spread|wrap|section|bg-alt|lead|display|h1|h2|h3|h4|btn|nav|brand|cap|trust|cta-band|price|faq|feat-list|feature-row|bill-toggle|site-footer|footer|chip|card|grid|statline|link-arrow|eyebrow|mono|tnum|ink-2|ink-3|brand-tx|body-lg|small|micro|maxw-prose|section-head|announce|hairline|dark-section|reveal|hl-mark|cmp|price-grid|price-card|modal-tag|modal-tags|value-statement|showcase-frame|page-head|mini-feat|engine-tests|test-pill|pricing-note|cmp-wrap)[^\n{]*\{)/gm,
    '.tensr-marketing $1'
  );

  out = out.replace(
    /--font-sans:\s*"Inter"[^;]+;/,
    "--font-sans: 'SuisseIntl', system-ui, -apple-system, sans-serif;"
  );
  out = out.replace(
    /--font-head:\s*"Inter Tight"[^;]+;/,
    "--font-head: 'SuisseIntl', system-ui, -apple-system, sans-serif;"
  );
  out = out.replace(
    /--font-mono:\s*"JetBrains Mono"[^;]+;/,
    "--font-mono: ui-monospace, 'SF Mono', Menlo, monospace;"
  );
  out = out.replace(/\s*font-feature-settings:\s*"cv11",\s*"ss01";\s*/g, '\n');

  return out;
}

function scopeMockCss(css) {
  return css.replace(/^(\.[a-zA-Z][^\n{]*\{)/gm, '.tensr-marketing $1');
}

function patchPageCss(css) {
  let out = css.replace(/\bbody\[/g, '.tensr-marketing[');
  out = out.replace(/^(\s*)(\.[a-zA-Z][^{]+)\{/gm, (match, indent, sel) => {
    if (sel.includes('.tensr-marketing')) return match;
    return `${indent}.tensr-marketing ${sel.trim()}{`;
  });
  return out;
}

function writeHtmlModule(name, exportName, html, pageCss) {
  if (pageCss) fs.writeFileSync(path.join(OUT, `${name}.css`), patchPageCss(pageCss));
  const escaped = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const cssImport = pageCss ? `import './${name}.css';\n` : '';
  fs.writeFileSync(
    path.join(OUT, `${name}.html.ts`),
    `${cssImport}export const ${exportName} = \`${escaped}\`;\n`
  );
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(STYLES, { recursive: true });

const siteCss = scopeSiteCss(fs.readFileSync(path.join(SRC, 'tensr-site.css'), 'utf8'));
const mockCss = scopeMockCss(fs.readFileSync(path.join(SRC, 'tensr-mock.css'), 'utf8'));
fs.writeFileSync(path.join(STYLES, 'tensr-site.css'), siteCss);
fs.writeFileSync(path.join(STYLES, 'tensr-mock.css'), mockCss);

for (const p of [
  { file: 'Home.html', name: 'home', exportName: 'HOME_HTML' },
  { file: 'Features.html', name: 'features', exportName: 'FEATURES_HTML' },
  { file: 'Pricing.html', name: 'pricing', exportName: 'PRICING_HTML' },
]) {
  const source = fs.readFileSync(path.join(SRC, p.file), 'utf8');
  writeHtmlModule(
    p.name,
    p.exportName,
    patchHtml(extractBetween(source, '<main>', '</main>')),
    extractStyleBlock(source)
  );
  console.log(`Built ${p.name}`);
}

console.log('Built marketing CSS');
