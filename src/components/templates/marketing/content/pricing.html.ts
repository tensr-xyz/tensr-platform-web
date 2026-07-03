import './pricing.css';
export const PRICING_HTML = `<section class="page-head" data-screen-label="Pricing / Head">
      <div class="wash"></div>
      <div class="wrap center">
        <span class="eyebrow center">Pricing</span>
        <h1 class="h1 mt-5" style="max-width: 20ch;">Straightforward pricing for serious analysis.</h1>
        <p class="lead mt-5" style="max-width: 52ch;">Three plans. Paid from day one — no freemium, no student tier. Cancel anytime.</p>
        <div class="row mt-8" style="justify-content: center;">
          <div class="bill-toggle" data-bill-toggle>
            <button data-mode="monthly">Monthly</button>
            <button data-mode="annual" data-on="true">Annual <span class="save">−20%</span></button>
          </div>
        </div>
      </div>
    </section>

    
    <section style="padding-bottom: clamp(40px, 5vw, 64px);" data-screen-label="Pricing / Tiers">
      <div class="wrap wrap-wide">
        <div class="price-grid">

          <div class="price-card reveal">
            <div class="tier">Pro</div>
            <div class="tier-sub">For individual researchers and analysts</div>
            <div class="price-amt">
              <span class="cur">$</span>
              <span class="val" data-price data-monthly="20" data-annual="16">16</span>
              <span class="per" data-per data-permonth="/mo">/mo · billed annually</span>
            </div>
            <div class="pc-note">Per user · cancel any time</div>
            <a class="btn" href="https://app.tensr.xyz">Get started</a>
            <ul class="pc-feats">
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> <span class="lead-feat">Full tri-modal workspace</span></li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Sheet, charts &amp; notebook</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Growing library of statistical tests</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Tensr Agent — 1,200 uses / month</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> 300 reports / month</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> CSV &amp; Markdown export · print to PDF</li>
            </ul>
          </div>

          <div class="price-card featured reveal">
            <div class="pc-tag">Power users</div>
            <div class="tier">Pro+</div>
            <div class="tier-sub">For power users who run a lot of analyses</div>
            <div class="price-amt">
              <span class="cur">$</span>
              <span class="val" data-price data-monthly="60" data-annual="48">48</span>
              <span class="per" data-per data-permonth="/mo">/mo · billed annually</span>
            </div>
            <div class="pc-note">Per user · cancel any time</div>
            <a class="btn btn-primary" href="https://app.tensr.xyz">Get started</a>
            <ul class="pc-feats">
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> <span class="lead-feat">Everything in Pro, plus</span></li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Tensr Agent — 5,000 uses / month</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> 1,200 reports / month</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Priority support</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> CSV &amp; Markdown export · print to PDF</li>
            </ul>
          </div>

          <div class="price-card reveal">
            <div class="tier">Teams</div>
            <div class="tier-sub">For groups working on shared projects</div>
            <div class="price-amt">
              <span class="cur">$</span>
              <span class="val" data-price data-monthly="40" data-annual="32">32</span>
              <span class="per" data-per data-permonth="/seat/mo">/seat/mo · billed annually</span>
            </div>
            <div class="pc-note">Per seat · 1 seat minimum</div>
            <a class="btn" href="https://app.tensr.xyz">Get started</a>
            <ul class="pc-feats">
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> <span class="lead-feat">Everything in Pro+, plus</span></li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Shared workspaces <span class="small ink-3">(Beta)</span></li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Tensr Agent — 10,000 uses / month (org-wide)</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> 3,000 reports / month</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Priority support</li>
            </ul>
          </div>

          <div class="price-card reveal">
            <div class="tier">Enterprise</div>
            <div class="tier-sub">For institutions with compliance requirements</div>
            <div class="price-amt">
              <span class="val" style="font-size: 40px;">Custom</span>
            </div>
            <div class="pc-note">Annual contract · volume pricing</div>
            <a class="btn btn-dark" href="/enterprise">Contact sales</a>
            <ul class="pc-feats">
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> <span class="lead-feat">Everything in Teams, plus</span></li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> SSO / SAML</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Audit logs &amp; role-based access</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> DPA available</li>
              <li><span class="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Dedicated support &amp; SLA</li>
            </ul>
          </div>
        </div>
        <div class="pricing-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--good)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          Change or cancel your plan at any time · no long-term lock-in
        </div>
      </div>
    </section>

    
    <section class="section" data-screen-label="Pricing / Compare">
      <div class="wrap wrap-wide">
        <div class="section-head center reveal">
          <span class="eyebrow center">Compare plans</span>
          <h2 class="h2 mt-4">Every detail, side by side.</h2>
        </div>
        <div class="cmp-wrap mt-12 reveal">
          <table class="cmp">
            <thead>
              <tr>
                <th style="width: 28%;">Feature</th>
                <th>Pro</th>
                <th class="col-feat">Pro+</th>
                <th>Teams</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr class="grp"><td colspan="5">Workspace</td></tr>
              <tr><th>Spreadsheet, charts &amp; notebook</th><td class="yes">●</td><td class="col-feat yes">●</td><td class="yes">●</td><td class="yes">●</td></tr>
              <tr><th>Command palette &amp; terminal</th><td class="yes">●</td><td class="col-feat yes">●</td><td class="yes">●</td><td class="yes">●</td></tr>
              <tr><th>Shared workspaces</th><td class="no">—</td><td class="col-feat no">—</td><td class="yes">Beta</td><td class="yes">●</td></tr>

              <tr class="grp"><td colspan="5">Analysis</td></tr>
              <tr><th>Statistical test library</th><td class="yes">●</td><td class="col-feat yes">●</td><td class="yes">●</td><td class="yes">●</td></tr>
              <tr><th>Report view &amp; assumption checks</th><td class="yes">●</td><td class="col-feat yes">●</td><td class="yes">●</td><td class="yes">●</td></tr>
              <tr><th>CSV / Markdown export · print to PDF</th><td class="yes">●</td><td class="col-feat yes">●</td><td class="yes">●</td><td class="yes">●</td></tr>
              <tr><th>Tensr Agent uses / month</th><td>1,200</td><td class="col-feat">5,000</td><td>10,000</td><td>Custom</td></tr>
              <tr><th>Reports / month</th><td>300</td><td class="col-feat">1,200</td><td>3,000</td><td>Custom</td></tr>

              <tr class="grp"><td colspan="5">Security &amp; support</td></tr>
              <tr><th>SSO / SAML</th><td class="no">—</td><td class="col-feat no">—</td><td class="no">—</td><td class="yes">●</td></tr>
              <tr><th>Audit logs &amp; RBAC</th><td class="no">—</td><td class="col-feat no">—</td><td class="no">—</td><td class="yes">●</td></tr>
              <tr><th>DPA available</th><td class="no">—</td><td class="col-feat no">—</td><td class="no">—</td><td class="yes">●</td></tr>
              <tr><th>Support</th><td>Standard</td><td class="col-feat">Priority</td><td>Priority</td><td>Dedicated</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    
    <section class="section bg-alt" data-screen-label="Pricing / FAQ">
      <div class="wrap">
        <div class="section-head center reveal">
          <span class="eyebrow center">FAQ</span>
          <h2 class="h2 mt-4">Questions, answered.</h2>
        </div>
        <div class="faq mt-12 reveal">
          <details open>
            <summary>Is there a free plan? <span class="pm"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></summary>
            <div class="ans">No. Tensr is a paid product. All plans can be cancelled anytime.</div>
          </details>
          <details>
            <summary>What counts as an agent use? <span class="pm"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></summary>
            <div class="ans">One executed analysis run — the agent reading your data and producing a result.</div>
          </details>
          <details>
            <summary>Can I switch between monthly and annual billing? <span class="pm"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></summary>
            <div class="ans">Yes, at any time. Annual billing saves 20%.</div>
          </details>
          <details>
            <summary>How does Teams billing work? <span class="pm"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></summary>
            <div class="ans">Per seat, minimum 1. Viewer access is free.</div>
          </details>
          <details>
            <summary>How is my data handled? <span class="pm"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></summary>
            <div class="ans">Data is encrypted in transit and at rest. It is never used to train models. <a href="https://tensr-1.gitbook.io/tensr/legal-policies/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy policy</a></div>
          </details>
          <details>
            <summary>Do you offer academic or non-profit pricing? <span class="pm"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></summary>
            <div class="ans">Yes — contact us for Team plan discounts.</div>
          </details>
        </div>
      </div>
    </section>

    
    <section class="section" data-screen-label="Pricing / CTA">
      <div class="wrap">
        <div class="cta-band reveal">
          <div class="glow"></div>
          <span class="eyebrow center" style="justify-content:center;">Get started</span>
          <h2 class="h1 mt-5">Pick a plan and get started today.</h2>
          <div class="row gap-3 mt-8" style="justify-content:center; flex-wrap:wrap;">
            <a class="btn btn-white btn-lg" href="https://app.tensr.xyz">View Pro</a>
            <a class="btn btn-lg" href="/enterprise" style="background:transparent; color:#fff; border-color:var(--dark-line);">Talk to sales <span class="arr">→</span></a>
          </div>
        </div>
      </div>
    </section>`;
