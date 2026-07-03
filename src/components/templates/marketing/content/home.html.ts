import './home.css';
export const HOME_HTML = `<section class="hero" data-screen-label="Home / Hero" data-hero-target>
      <div class="hero-wash"></div>
      <div class="wrap wrap-wide">
        <div class="hero-grid">
          <div class="hero-copy">
            <span class="eyebrow">Browser-native · No install · Statistical workspace</span>
            <h1 class="display">Your analysis, from first look to final result.</h1>
            <p class="lead">A workspace where your data, your tests, and your thinking live together. Run statistics, build charts, and annotate your results — without switching tools or losing your thread.</p>
            <div class="hero-actions">
              <a class="btn btn-primary btn-lg" href="/pricing">View plans</a>
              <a class="btn btn-lg" href="#showcase">See it in action <span class="arr">→</span></a>
            </div>
            <div class="hero-note">
              <svg class="ck" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              80+ analysis types. Everything from descriptives to SEM, in one place.
            </div>
          </div>

          
          <div class="hero-visual reveal">
            <div class="float-badge" style="left:-26px; bottom:54px;">
              <span class="ic" style="background:var(--brand)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
              </span>
              <span><span class="k">Pearson r</span><br /><span class="v mono">0.847 · p&lt;.001</span></span>
            </div>
            <div class="win">
              <div class="win-bar">
                <div class="win-dots"><i></i><i></i><i></i></div>
                <div class="win-omni"><svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>tensr.app/w/nba-2024</div>
                <div class="win-right av-stack">
                  <span class="av s av-1">OL</span><span class="av s av-2">MR</span><span class="av s av-3">JP</span>
                </div>
              </div>
              <div class="hero-mock">
                
                <div class="hero-sheet">
                  <div class="sheet">
                    <table>
                      <thead>
                        <tr>
                          <th class="idx">#</th>
                          <th>Player <span class="ty txt">abc</span></th>
                          <th>Pos <span class="ty txt">abc</span></th>
                          <th>MP <span class="ty">#</span></th>
                          <th>PTS <span class="ty">#</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td class="idx">1</td><td class="sel">Precious Achiuwa</td><td><span class="posbadge">C</span></td><td class="num">20.7</td><td class="num">7.6</td></tr>
                        <tr><td class="idx">2</td><td>Bam Adebayo</td><td><span class="posbadge">C</span></td><td class="num">34.0</td><td class="num">19.3</td></tr>
                        <tr><td class="idx">3</td><td>Ochai Agbaji</td><td><span class="posbadge">SG</span></td><td class="num">21.0</td><td class="num">5.8</td></tr>
                        <tr><td class="idx">4</td><td>Santi Aldama</td><td><span class="posbadge">PF</span></td><td class="num">26.4</td><td class="num">10.7</td></tr>
                        <tr><td class="idx">5</td><td>Nickeil Alexander‑W.</td><td><span class="posbadge">SG</span></td><td class="num">28.9</td><td class="num">12.4</td></tr>
                        <tr><td class="idx">6</td><td>Grayson Allen</td><td><span class="posbadge">SG</span></td><td class="num">33.5</td><td class="num">13.5</td></tr>
                        <tr><td class="idx">7</td><td>Jarrett Allen</td><td><span class="posbadge">C</span></td><td class="num">32.6</td><td class="num">16.5</td></tr>
                        <tr><td class="idx">8</td><td>Jose Alvarado</td><td><span class="posbadge">PG</span></td><td class="num">21.7</td><td class="num">7.1</td></tr>
                        <tr><td class="idx">9</td><td>Kyle Anderson</td><td><span class="posbadge">PF</span></td><td class="num">22.9</td><td class="num">6.4</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div class="agent ws-agent">
                  <div class="agent-head">
                    <span class="ico">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>
                    </span>
                    <div>
                      <div class="t">Tensr Agent</div>
                      <div class="s"><span class="dot"></span> Connected · 23 ops</div>
                    </div>
                  </div>
                  <div class="agent-body">
                    <div class="agent-kicker"><span class="d"></span> Reading dataset</div>
                    <div class="agent-msg">I see <span class="hl">505 NBA players</span> across <span class="hl">15 columns</span>. 14 numeric, 1 categorical. Ask me anything, or pick a starter:</div>
                    <div class="agent-sub">Suggested</div>
                    <div class="agent-sugg">What's the correlation between minutes played and points scored?</div>
                    <div class="agent-sugg">Run a one‑way ANOVA of PTS across positions</div>
                  </div>
                  <div class="agent-input">
                    <div class="ph">Ask about your data…</div>
                    <div class="tools">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
                      <span class="send"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 14-7-7 14-2-5-5-2Z"/></svg></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    
    <section class="section-sm" style="padding-block: 28px 8px;" data-screen-label="Home / Trust">
      <div class="wrap">
        <p class="center small ink-3" style="letter-spacing: 0.02em;">Built for researchers, analysts, and anyone who&apos;s outgrown spreadsheet statistics.</p>
      </div>
    </section>

    
    <section class="section" data-screen-label="Home / Value">
      <div class="wrap">
        <div class="grid-2" style="gap: clamp(40px,6vw,90px); align-items: start;">
          <div class="reveal">
            <p class="value-statement mt-5">Three ways to work with data. <span class="hl-mark">Finally in the same file.</span></p>
          </div>
          <div class="reveal">
            <ul class="feat-list">
              <li><span class="ck"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Run a t-test by clicking through a menu, or write it in Python — your choice, same result</li>
              <li><span class="ck"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> Assumption checks, effect sizes, and post-hoc tests are part of every analysis, not afterthoughts</li>
              <li><span class="ck"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span> The AI agent reads your dataset and tells you what it sees before you even ask</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    
    <section class="section bg-alt" id="showcase" data-screen-label="Home / Showcase">
      <div class="wrap">
        <div class="section-head center reveal">
          <span class="eyebrow center">The workspace</span>
          <h2 class="h1 mt-4">Your whole analysis, in one view.</h2>
          <p class="lead mt-5" style="max-width: 54ch; margin-inline: auto;">Columns and types on the left. A real spreadsheet in the centre. The agent on the right — reading along, ready to run the next test.</p>
        </div>
      </div>
      <div class="wrap wrap-wide mt-12 reveal">
        <div class="win showcase-frame">
          <div class="win-bar">
            <div class="win-dots"><i></i><i></i><i></i></div>
            <div class="win-omni"><svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>tensr.app/w/nba-2024</div>
            <div class="win-right av-stack">
              <span class="av s av-1">OL</span><span class="av s av-2">MR</span><span class="av s av-3">JP</span>
            </div>
          </div>
          <div class="ws">
            
            <div class="ws-rail">
              <div class="rh">14 numeric · 1 text</div>
              <div class="colrow"><span class="ty txt">abc</span> Player</div>
              <div class="colrow"><span class="ty txt">abc</span> Pos</div>
              <div class="colrow"><span class="ty">#</span> Age</div>
              <div class="colrow"><span class="ty">#</span> Tm</div>
              <div class="colrow"><span class="ty">#</span> G</div>
              <div class="colrow"><span class="ty">#</span> MP</div>
              <div class="colrow"><span class="ty">#</span> FG%</div>
              <div class="colrow"><span class="ty">#</span> 3P</div>
              <div class="colrow"><span class="ty">#</span> TRB</div>
              <div class="colrow"><span class="ty">#</span> AST</div>
              <div class="colrow"><span class="ty">#</span> PTS</div>
            </div>
            
            <div class="ws-main">
              <div class="ws-subtabs">
                <div class="ws-subtab on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg> Sheet</div>
                <div class="ws-subtab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h16"/><circle cx="8" cy="14" r="1.4" fill="currentColor"/><circle cx="13" cy="10" r="1.4" fill="currentColor"/><circle cx="17" cy="7" r="1.4" fill="currentColor"/></svg> Charts</div>
                <div class="ws-subtab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg> Notebook</div>
              </div>
              <div class="sheet">
                <table>
                  <thead>
                    <tr>
                      <th class="idx">#</th>
                      <th>Player <span class="ty txt">abc</span></th>
                      <th>Pos <span class="ty txt">abc</span></th>
                      <th>Age <span class="ty">#</span></th>
                      <th>MP <span class="ty">#</span></th>
                      <th>FG% <span class="ty">#</span></th>
                      <th>TRB <span class="ty">#</span></th>
                      <th>AST <span class="ty">#</span></th>
                      <th>PTS <span class="ty">#</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td class="idx">1</td><td class="sel">Precious Achiuwa</td><td><span class="posbadge">C</span></td><td class="num">24</td><td class="num">20.7</td><td class="num">.503</td><td class="num">6.6</td><td class="num">1.0</td><td class="num">7.6</td></tr>
                    <tr><td class="idx">2</td><td>Bam Adebayo</td><td><span class="posbadge">C</span></td><td class="num">26</td><td class="num">34.0</td><td class="num">.521</td><td class="num">10.4</td><td class="num">3.9</td><td class="num">19.3</td></tr>
                    <tr><td class="idx">3</td><td>Ochai Agbaji</td><td><span class="posbadge">SG</span></td><td class="num">23</td><td class="num">21.0</td><td class="num">.444</td><td class="num">2.8</td><td class="num">1.2</td><td class="num">5.8</td></tr>
                    <tr><td class="idx">4</td><td>Santi Aldama</td><td><span class="posbadge">PF</span></td><td class="num">23</td><td class="num">26.4</td><td class="num">.470</td><td class="num">5.8</td><td class="num">2.3</td><td class="num">10.7</td></tr>
                    <tr><td class="idx">5</td><td>Nickeil Alexander‑W.</td><td><span class="posbadge">SG</span></td><td class="num">25</td><td class="num">28.9</td><td class="num">.461</td><td class="num">3.4</td><td class="num">2.9</td><td class="num">12.4</td></tr>
                    <tr><td class="idx">6</td><td>Grayson Allen</td><td><span class="posbadge">SG</span></td><td class="num">28</td><td class="num">33.5</td><td class="num">.498</td><td class="num">3.9</td><td class="num">3.1</td><td class="num">13.5</td></tr>
                    <tr><td class="idx">7</td><td>Jarrett Allen</td><td><span class="posbadge">C</span></td><td class="num">25</td><td class="num">32.6</td><td class="num">.633</td><td class="num">10.5</td><td class="num">2.7</td><td class="num">16.5</td></tr>
                    <tr><td class="idx">8</td><td>Jose Alvarado</td><td><span class="posbadge">PG</span></td><td class="num">25</td><td class="num">21.7</td><td class="num">.435</td><td class="num">2.3</td><td class="num">3.6</td><td class="num">7.1</td></tr>
                    <tr><td class="idx">9</td><td>Kyle Anderson</td><td><span class="posbadge">PF</span></td><td class="num">30</td><td class="num">22.9</td><td class="num">.461</td><td class="num">4.3</td><td class="num">4.2</td><td class="num">6.4</td></tr>
                    <tr><td class="idx">10</td><td>Giannis Antetokounmpo</td><td><span class="posbadge">PF</span></td><td class="num">29</td><td class="num">35.2</td><td class="num">.611</td><td class="num">11.5</td><td class="num">6.5</td><td class="num">30.4</td></tr>
                    <tr><td class="idx">11</td><td>Cole Anthony</td><td><span class="posbadge">PG</span></td><td class="num">24</td><td class="num">23.4</td><td class="num">.439</td><td class="num">3.9</td><td class="num">3.7</td><td class="num">11.0</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="ws-status">
                <span class="ok">● Saved</span>
                <span>505 rows · 15 cols</span>
                <span>Player1</span>
                <span style="margin-left:auto;">⌘K  ·  Terminal ⌘\`</span>
              </div>
            </div>
            
            <div class="agent ws-agent">
              <div class="agent-head">
                <span class="ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg></span>
                <div><div class="t">Tensr Agent</div><div class="s"><span class="dot"></span> Connected · 24 ops</div></div>
              </div>
              <div class="agent-body">
                <div class="agent-msg" style="font-size:13px;">Correlation between <b>MP</b> and <b>PTS</b> across 505 players:</div>
                <div class="mini-table">
                  <div class="r h"><span class="c">Statistic</span><span class="c num">Value</span><span class="c num">95% CI</span></div>
                  <div class="r"><span class="c">Pearson r</span><span class="c num" style="color:var(--brand-deep);font-weight:600;">0.847</span><span class="c num">.82–.87</span></div>
                  <div class="r"><span class="c">p‑value</span><span class="c num">&lt;.001</span><span class="c num">—</span></div>
                  <div class="r"><span class="c">n</span><span class="c num">505</span><span class="c num">—</span></div>
                </div>
                <div class="interp" style="margin-top:0;">
                  <span class="ai"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v6M3 12h6"/></svg></span>
                  <span class="x"><b>Strong positive correlation.</b> Players who log more minutes score substantially more. Open as a full report?</span>
                </div>
                <div class="row gap-2" style="flex-wrap:wrap;">
                  <span class="agent-sugg" style="padding:7px 11px;font-size:12px;">Open as report</span>
                  <span class="agent-sugg" style="padding:7px 11px;font-size:12px;">Plot scatter</span>
                </div>
              </div>
              <div class="agent-foot">claude‑haiku · stats‑pack v0.4</div>
            </div>
          </div>
        </div>
        <div class="modal-tags">
          <span class="modal-tag"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg> Spreadsheet</span>
          <span class="modal-tag"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h16"/><circle cx="8" cy="14" r="1.4" fill="currentColor"/><circle cx="13" cy="10" r="1.4" fill="currentColor"/><circle cx="17" cy="7" r="1.4" fill="currentColor"/></svg> Charts</span>
          <span class="modal-tag"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg> Notebook</span>
          <span class="modal-tag"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg> AI agent</span>
          <span class="modal-tag"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h11a4 4 0 1 0-4-4"/><path d="m12 16 4-4-4-4"/></svg> Command palette ⌘K</span>
        </div>
      </div>
    </section>

    
    <section class="section" data-screen-label="Home / Capabilities">
      <div class="wrap">
        <div class="section-head reveal">
          <span class="eyebrow">Capabilities</span>
          <h2 class="h1 mt-4">Everything a serious analysis needs.</h2>
          <p class="lead mt-5" style="max-width: 52ch;">Not a thinner version of a stats package — a more capable one, with the parts researchers actually reach for built in.</p>
        </div>
        <div class="cap-grid mt-12">
          <div class="cap reveal">
            <div class="cap-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></svg></div>
            <h3>An agent that starts with your data</h3>
            <p>Not a chat window. It reads your dataset, flags what&apos;s worth testing, and explains the output in plain language.</p>
          </div>
          <div class="cap reveal">
            <div class="cap-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg></div>
            <h3>Results you can actually hand over</h3>
            <p>Structured tables, assumption checks, and APA-style writeups, ready to copy or export.</p>
          </div>
          <div class="cap reveal">
            <div class="cap-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg></div>
            <h3>One file, three ways in</h3>
            <p>A typed spreadsheet, a chart view, and a Python notebook. No import, no sync, no divergence.</p>
          </div>
          <div class="cap reveal">
            <div class="cap-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M16 20a5.5 5.5 0 0 1 5-2.5"/></svg></div>
            <h3>Shared workspaces <span class="small ink-3">(Beta)</span></h3>
            <p>Annotate results, leave comments on cells, and share your analysis via link.</p>
          </div>
          <div class="cap reveal">
            <div class="cap-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/></svg></div>
            <h3>Extensible from day one <span class="small ink-3">(Early access)</span></h3>
            <p>Add specialist toolkits for Bayesian methods, time series, and more.</p>
          </div>
          <div class="cap reveal">
            <div class="cap-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><rect x="6" y="11" width="3" height="7" rx="0.5"/><rect x="11" y="6" width="3" height="12" rx="0.5"/><rect x="16" y="14" width="3" height="4" rx="0.5"/></svg></div>
            <h3>A growing library of statistical tests</h3>
            <p>Descriptives, ANOVA, regression, factor analysis, SEM, nonparametrics, and more.</p>
          </div>
        </div>
      </div>
    </section>

    
    <section class="section" data-screen-label="Home / CTA">
      <div class="wrap">
        <div class="cta-band reveal">
          <div class="glow"></div>
          <span class="eyebrow center" style="justify-content:center;">Get started</span>
          <h2 class="h1 mt-5">Your data is already waiting.</h2>
          <p class="lead mt-4" style="max-width: 48ch; margin-inline: auto;">Bring a CSV and run your first analysis in minutes. No install, no configuration.</p>
          <div class="row gap-3 mt-8" style="justify-content:center; flex-wrap:wrap;">
            <a class="btn btn-white btn-lg" href="/pricing">View plans</a>
            <a class="btn btn-lg" href="/features" style="background:transparent; color:#fff; border-color:var(--dark-line);">See all features <span class="arr">→</span></a>
          </div>
        </div>
      </div>
    </section>`;
