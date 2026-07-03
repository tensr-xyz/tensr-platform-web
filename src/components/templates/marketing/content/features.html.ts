import './features.css';
export const FEATURES_HTML = `<section class="page-head" data-screen-label="Features / Head">
      <div class="wash"></div>
      <div class="wrap center">
        <span class="eyebrow center">Features</span>
        <h1 class="h1 mt-5" style="max-width: 18ch;">From raw data to a result you can stand behind.</h1>
        <p class="lead mt-5" style="max-width: 56ch;">Five capabilities designed to remove the gaps between collecting data, analysing it, and communicating what it means.</p>
        <div class="row gap-3 mt-8" style="flex-wrap: wrap; justify-content: center;">
          <a class="btn btn-primary btn-lg" href="/pricing">View plans</a>
        </div>
      </div>
    </section>

    
    <section class="section" data-screen-label="Features / Moments">
      <div class="wrap wrap-wide">

        
        <div class="feature-row" id="agent">
          <div class="feature-copy reveal">
            <div class="num">01 — Tensr Agent</div>
            <h2 class="h2">The agent that reads before it talks</h2>
            <p class="lead">Most AI tools wait for you to ask. Tensr Agent looks at your data first — column types, distributions, missing values — then tells you what it sees and what tests make sense. Run the analysis directly from the conversation, or take the suggestion and go manual. Either way, the agent explains the output in terms you can use.</p>
          </div>
          <div class="feature-visual reveal">
            <div class="win">
              <div class="win-bar"><div class="win-dots"><i></i><i></i><i></i></div><div class="win-omni"><svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>Tensr Agent</div></div>
              <div class="agent" style="height: 440px;">
                <div class="agent-head">
                  <span class="ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg></span>
                  <div><div class="t">Tensr Agent</div><div class="s"><span class="dot"></span> Connected · 31 ops</div></div>
                </div>
                <div class="agent-body" style="overflow:hidden;">
                  <div class="row gap-2" style="align-self:flex-end; max-width:85%;"><div style="background:var(--brand);color:#fff;padding:9px 13px;border-radius:13px 13px 4px 13px;font-size:13px;">Is scoring different across positions?</div></div>
                  <div class="agent-msg" style="font-size:13px;">Running a one‑way ANOVA of <b>PTS</b> by <b>position</b> (5 groups, n=505):</div>
                  <div class="mini-table">
                    <div class="r h"><span class="c">Source</span><span class="c num">F</span><span class="c num">p</span></div>
                    <div class="r"><span class="c">Position</span><span class="c num">8.41</span><span class="c num" style="color:var(--brand-deep);font-weight:600;">&lt;.001</span></div>
                    <div class="r"><span class="c">η²</span><span class="c num">0.063</span><span class="c num">—</span></div>
                  </div>
                  <div class="interp" style="margin-top:0;">
                    <span class="ai"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v6M3 12h6"/></svg></span>
                    <span class="x"><b>Significant difference.</b> Position explains ~6% of variance in scoring. Centers and guards differ most — want the Tukey post‑hoc?</span>
                  </div>
                  <div class="row gap-2" style="flex-wrap:wrap;">
                    <span class="agent-sugg" style="padding:7px 11px;font-size:12px;">Open as report</span>
                    <span class="agent-sugg" style="padding:7px 11px;font-size:12px;">Run Tukey HSD</span>
                    <span class="agent-sugg" style="padding:7px 11px;font-size:12px;">Add to notebook</span>
                  </div>
                </div>
                <div class="agent-foot">claude‑haiku · stats‑pack v0.4 · 31 ops</div>
              </div>
            </div>
          </div>
        </div>

        
        <div class="feature-row flip" id="report">
          <div class="feature-copy reveal">
            <div class="num">02 — Analysis reports</div>
            <h2 class="h2">Results that hold up</h2>
            <p class="lead">Every analysis produces a structured report: summary tables, assumption checks, and effect sizes alongside the main result. APA-style tables and writeups are included. Export to CSV or Markdown; print to PDF.</p>
          </div>
          <div class="feature-visual reveal">
            <div class="win">
              <div class="win-bar"><div class="win-dots"><i></i><i></i><i></i></div><div class="win-omni"><svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>tensr.app/w/nba-2024/report</div></div>
              <div class="report" style="height: 470px; overflow: hidden;">
                <div class="report-top">
                  <span class="t"><span class="kind">One‑way ANOVA</span> Points scored by position</span>
                  <span class="chip chip-good" style="height:22px;"><span class="d"></span> α = .05</span>
                </div>
                <div class="report-body">
                  <div class="report-meta">
                    <div class="m"><div class="k">DV</div><div class="v">PTS</div></div>
                    <div class="m"><div class="k">Factor</div><div class="v">Pos</div></div>
                    <div class="m"><div class="k">Groups</div><div class="v">5</div></div>
                    <div class="m"><div class="k">n</div><div class="v">505</div></div>
                    <div class="m" style="border-right:0;"><div class="k">Engine</div><div class="v">scipy</div></div>
                  </div>
                  <div class="block">
                    <div class="block-h"><span class="ix">1</span><span class="bt">ANOVA table</span><span class="kind">f_oneway</span></div>
                    <div class="block-body">
                      <table class="stat-table">
                        <thead><tr><th>Source</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>p</th><th>η²</th></tr></thead>
                        <tbody>
                          <tr class="hot"><td>Position</td><td>1842.6</td><td>4</td><td>460.7</td><td>8.41</td><td class="sig">&lt;.001</td><td>.063</td></tr>
                          <tr><td>Residual</td><td>27384.1</td><td>500</td><td>54.8</td><td>—</td><td>—</td><td>—</td></tr>
                        </tbody>
                      </table>
                      <div class="interp">
                        <span class="ai"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v6M3 12h6"/></svg></span>
                        <span class="x"><b>Scoring differs significantly by position,</b> F(4, 500) = 8.41, p &lt; .001. The effect is small‑to‑moderate (η² = .063).</span>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div class="block-h"><span class="ix">2</span><span class="bt">Assumption checks</span><span class="kind">3 tests</span></div>
                    <div class="block-body">
                      <div class="checks">
                        <div class="check"><span class="name">Shapiro–Wilk</span> Normality of residuals <span class="badge pass">✓ Pass · p=.21</span></div>
                        <div class="check"><span class="name">Levene</span> Homogeneity of variance <span class="badge warn">! Check · p=.04</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        
        <div class="feature-row" id="workspace">
          <div class="feature-copy reveal">
            <div class="num">03 — Workspace</div>
            <h2 class="h2">One file. Three views.</h2>
            <p class="lead">The spreadsheet, the chart panel, and the Python notebook all point at the same data. Edit a value in the grid and the notebook sees it. Build a chart from the notebook and it appears in the chart view. No syncing, no re-importing.</p>
          </div>
          <div class="feature-visual reveal">
            <div class="win">
              <div class="win-bar"><div class="win-dots"><i></i><i></i><i></i></div><div class="win-omni"><svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>tensr.app/w/nba-2024</div></div>
              <div class="ws-main" style="height: 440px;">
                <div class="ws-subtabs">
                  <div class="ws-subtab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg> Sheet</div>
                  <div class="ws-subtab on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h16"/><circle cx="8" cy="14" r="1.4" fill="currentColor"/><circle cx="13" cy="10" r="1.4" fill="currentColor"/><circle cx="17" cy="7" r="1.4" fill="currentColor"/></svg> Charts</div>
                  <div class="ws-subtab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg> Notebook</div>
                </div>
                <div class="chartwrap">
                  <div class="chart-head">
                    <div class="t">PTS vs Minutes played</div>
                    <div class="row gap-2"><span class="chip" style="height:24px;">X: MP</span><span class="chip" style="height:24px;">Y: PTS</span><span class="chip chip-brand" style="height:24px;">Colour: Pos</span></div>
                  </div>
                  <div class="scatter">
                    <div class="gl" style="bottom:25%"></div><div class="gl" style="bottom:50%"></div><div class="gl" style="bottom:75%"></div>
                    <div class="gv" style="left:25%"></div><div class="gv" style="left:50%"></div><div class="gv" style="left:75%"></div>
                    <div class="reg" style="left:3%; bottom:18%; width:92%; transform: rotate(-27deg);"></div>
                    <span class="pt" style="left:12%; bottom:14%; background:hsl(250 90% 60%)"></span>
                    <span class="pt" style="left:18%; bottom:22%; background:hsl(212 80% 48%)"></span>
                    <span class="pt" style="left:24%; bottom:19%; background:hsl(150 50% 40%)"></span>
                    <span class="pt" style="left:28%; bottom:30%; background:hsl(20 80% 55%)"></span>
                    <span class="pt" style="left:33%; bottom:26%; background:hsl(330 60% 52%)"></span>
                    <span class="pt" style="left:38%; bottom:38%; background:hsl(250 90% 60%)"></span>
                    <span class="pt" style="left:42%; bottom:33%; background:hsl(212 80% 48%)"></span>
                    <span class="pt" style="left:47%; bottom:46%; background:hsl(150 50% 40%)"></span>
                    <span class="pt" style="left:51%; bottom:41%; background:hsl(20 80% 55%)"></span>
                    <span class="pt" style="left:56%; bottom:52%; background:hsl(250 90% 60%)"></span>
                    <span class="pt" style="left:60%; bottom:48%; background:hsl(330 60% 52%)"></span>
                    <span class="pt" style="left:65%; bottom:60%; background:hsl(212 80% 48%)"></span>
                    <span class="pt" style="left:70%; bottom:55%; background:hsl(150 50% 40%)"></span>
                    <span class="pt" style="left:75%; bottom:68%; background:hsl(250 90% 60%)"></span>
                    <span class="pt" style="left:80%; bottom:64%; background:hsl(20 80% 55%)"></span>
                    <span class="pt" style="left:85%; bottom:78%; background:hsl(250 90% 60%)"></span>
                    <span class="pt" style="left:89%; bottom:72%; background:hsl(212 80% 48%)"></span>
                    <span class="pt" style="left:46%; bottom:20%; background:hsl(330 60% 52%)"></span>
                    <span class="pt" style="left:62%; bottom:35%; background:hsl(150 50% 40%)"></span>
                    <span class="pt" style="left:30%; bottom:42%; background:hsl(250 90% 60%)"></span>
                  </div>
                  <div class="chart-legend">
                    <span class="lg"><span class="sw" style="background:hsl(250 90% 60%)"></span> PG</span>
                    <span class="lg"><span class="sw" style="background:hsl(212 80% 48%)"></span> SG</span>
                    <span class="lg"><span class="sw" style="background:hsl(150 50% 40%)"></span> SF</span>
                    <span class="lg"><span class="sw" style="background:hsl(20 80% 55%)"></span> PF</span>
                    <span class="lg"><span class="sw" style="background:hsl(330 60% 52%)"></span> C</span>
                    <span class="lg" style="margin-left:auto; color:var(--brand-deep); font-weight:600;">r = 0.847 · regression overlay</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        
        <div class="feature-row flip" id="collaboration">
          <div class="feature-copy reveal">
            <div class="num">04 — Shared workspaces <span class="small ink-3">(Beta)</span></div>
            <h2 class="h2">Analysis is rarely solo work</h2>
            <p class="lead">Share your workspace via link. Collaborators can view results, leave comments on cells, and annotate findings. Full real-time collaboration is on the roadmap — shared workspaces in the current release are stable for async review and hand-off.</p>
          </div>
          <div class="feature-visual reveal">
            <div class="win">
              <div class="win-bar">
                <div class="win-dots"><i></i><i></i><i></i></div>
                <div class="win-omni"><svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>tensr.app/w/nba-2024</div>
                <div class="win-right av-stack"><span class="av s av-1">OL</span><span class="av s av-2">MR</span><span class="av s av-3">JP</span><span class="av s" style="background:var(--w-fg-3)">+2</span></div>
              </div>
              <div class="collab" style="height: 440px; position: relative;">
                <div class="nb-md" style="margin-bottom:12px;"><h4>Discussion — scoring by position</h4><p>Shared notebook · last edited 2 min ago</p></div>
                <div class="collab-doc">
                  <div class="block-h" style="border-bottom:1px solid var(--w-line);"><span class="ix">2</span><span class="bt">Correlation matrix</span><span class="kind">heatmap</span></div>
                  <div class="collab-rows" style="position: relative;">
                    <div class="cursor-flag" style="left:32%; top:6px; background:hsl(212 80% 48%)">Maria</div>
                    <div class="cursor-flag" style="left:64%; top:42px; background:hsl(150 50% 40%)">Jordan</div>
                    <div class="collab-line" style="width:88%"></div>
                    <div class="collab-line" style="width:74%"></div>
                    <div class="collab-line" style="width:81%; background:var(--brand-soft)"></div>
                    <div class="collab-line" style="width:60%"></div>
                  </div>
                </div>
                <div class="comment-bub">
                  <span class="av s av-2">MR</span>
                  <span class="x"><span class="nm">Maria Rivas</span> Should we report ω² here instead? It's the more conservative estimate for this n. <span style="color:var(--brand-deep);font-weight:600;">@Jordan</span></span>
                </div>
                <div class="comment-bub" style="margin-left:28px;">
                  <span class="av s av-3">JP</span>
                  <span class="x"><span class="nm">Jordan Park</span> Agreed — added both to the report block. ✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        
        <div class="feature-row" id="plugins">
          <div class="feature-copy reveal">
            <div class="num">05 — Plugins <span class="small ink-3">(Early access)</span></div>
            <h2 class="h2">Built to extend</h2>
            <p class="lead">The plugin layer lets you add specialist toolkits beyond the core library — Bayesian methods, geospatial analysis, survey tools. The catalog is growing; early-access partners can publish directly.</p>
          </div>
          <div class="feature-visual reveal">
            <div class="win">
              <div class="win-bar"><div class="win-dots"><i></i><i></i><i></i></div><div class="win-omni"><svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>tensr.app/plugins</div></div>
              <div style="height: 440px; background: var(--w-bg); overflow: hidden;">
                <div class="plug-grid">
                  <div class="plug-card">
                    <div class="ic" style="background:hsl(250 90% 60%)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 0 1 16 0M4 12a8 8 0 0 0 16 0"/><circle cx="12" cy="12" r="2"/></svg></div>
                    <div><div class="nm">Bayesian Toolkit</div><div class="au">by stan‑labs</div></div>
                    <div class="meta"><span class="lang">Python</span><span class="stars">★ 4.9</span><span>·</span><span>12.4k</span></div>
                    <div class="get brand">Get</div>
                  </div>
                  <div class="plug-card">
                    <div class="ic" style="background:hsl(212 80% 48%)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18 9 11l4 3 6-8"/><path d="M4 21h16"/></svg></div>
                    <div><div class="nm">Time Series Pro</div><div class="au">by forecastr</div></div>
                    <div class="meta"><span class="lang">R</span><span class="stars">★ 4.7</span><span>·</span><span>8.1k</span></div>
                    <div class="get">$9/mo</div>
                  </div>
                  <div class="plug-card">
                    <div class="ic" style="background:hsl(150 50% 40%)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8Z"/></svg></div>
                    <div><div class="nm">Geo Analysis</div><div class="au">by cartoml</div></div>
                    <div class="meta"><span class="lang">Python</span><span class="stars">★ 4.6</span><span>·</span><span>5.3k</span></div>
                    <div class="get">Get</div>
                  </div>
                  <div class="plug-card">
                    <div class="ic" style="background:hsl(20 80% 55%)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
                    <div><div class="nm">Survey Insights</div><div class="au">by likert.io</div></div>
                    <div class="meta"><span class="lang">TS</span><span class="stars">★ 4.8</span><span>·</span><span>6.7k</span></div>
                    <div class="get">Get</div>
                  </div>
                  <div class="plug-card">
                    <div class="ic" style="background:hsl(330 60% 52%)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18"/></svg></div>
                    <div><div class="nm">Power Calculator</div><div class="au">by gpower</div></div>
                    <div class="meta"><span class="lang">JS</span><span class="stars">★ 4.5</span><span>·</span><span>4.0k</span></div>
                    <div class="get">Get</div>
                  </div>
                  <div class="plug-card" style="border-style:dashed; align-items:flex-start; justify-content:center;">
                    <div class="ic" style="background:var(--w-surface-3); color:var(--w-fg-3)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg></div>
                    <div><div class="nm">Publish your own</div><div class="au">Earn from your toolkit</div></div>
                    <div class="get" style="margin-top:auto;">Start</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>

    
    <section class="section bg-alt" data-screen-label="Features / Engine">
      <div class="wrap">
        <div class="section-head reveal">
          <span class="eyebrow">The engine</span>
          <h2 class="h1 mt-4">80+ analysis types. And counting.</h2>
          <p class="lead mt-5" style="max-width: 54ch;">The command palette surfaces everything — descriptives, t-tests, ANOVA, nonparametrics, regression, factor analysis, SEM, time series, and more. Some advanced types are in active development; the menu tells you exactly what&apos;s available today.</p>
        </div>
        <div class="mt-10 reveal">
          <p class="eyebrow" style="color: var(--ink-3);">Analysis types, ready to run</p>
          <div class="engine-tests mt-4">
            <span class="test-pill">Descriptive statistics</span>
            <span class="test-pill">Frequencies</span>
            <span class="test-pill">One‑sample t‑test</span>
            <span class="test-pill">Independent t‑test</span>
            <span class="test-pill">Paired t‑test</span>
            <span class="test-pill">One‑way ANOVA</span>
            <span class="test-pill">Factorial ANOVA</span>
            <span class="test-pill">Repeated‑measures ANOVA</span>
            <span class="test-pill">ANCOVA</span>
            <span class="test-pill">Pearson correlation</span>
            <span class="test-pill">Spearman ρ</span>
            <span class="test-pill">Partial correlation</span>
            <span class="test-pill">Linear regression <span class="mono">OLS</span></span>
            <span class="test-pill">Logistic regression</span>
            <span class="test-pill">Mann–Whitney U</span>
            <span class="test-pill">Wilcoxon signed‑rank</span>
            <span class="test-pill">Kruskal–Wallis</span>
            <span class="test-pill">Chi‑square</span>
            <span class="test-pill">Cronbach's α</span>
            <span class="test-pill" style="color:var(--brand-deep); border-color:var(--brand-line); background:var(--brand-soft);">+ more added regularly</span>
          </div>
        </div>
        <div class="mini-feat-grid mt-12">
          <div class="mini-feat reveal">
            <div class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h11a4 4 0 1 0-4-4"/><path d="m12 16 4-4-4-4"/></svg></div>
            <h4>Command palette ⌘K</h4>
            <p>Every test, transform, and plugin one search away — run an analysis without touching a menu.</p>
          </div>
          <div class="mini-feat reveal">
            <div class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg></div>
            <h4>Integrated terminal ⌘\`</h4>
            <p>A resizable Python REPL — numpy, scipy, statsmodels — right beside your data.</p>
          </div>
          <div class="mini-feat reveal">
            <div class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg></div>
            <h4>Full operation history</h4>
            <p>Each result footer shows the exact function call — re-run, annotate, or audit in a click.</p>
          </div>
        </div>
      </div>
    </section>

    
    <section class="section" data-screen-label="Features / CTA">
      <div class="wrap">
        <div class="cta-band reveal">
          <div class="glow"></div>
          <span class="eyebrow center" style="justify-content:center;">Get started</span>
          <h2 class="h1 mt-5">See it on your own data.</h2>
          <div class="row gap-3 mt-8" style="justify-content:center; flex-wrap:wrap;">
            <a class="btn btn-white btn-lg" href="https://app.tensr.xyz">Upload a CSV</a>
            <a class="btn btn-lg" href="/pricing" style="background:transparent; color:#fff; border-color:var(--dark-line);">View plans <span class="arr">→</span></a>
          </div>
        </div>
      </div>
    </section>`;
