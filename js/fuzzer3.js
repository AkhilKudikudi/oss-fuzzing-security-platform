/*
  FILE    : js/fuzzer3.js  (Engine Helpers Part 1b)
  PURPOSE : checkCompletion, generateFinalReport, sendTests,
            tickSessionClock, detectBugs, terminalLogs,
            logToTerminal, setBadgeRunning, randomBugType.
  LOADED  : After fuzzer.js — shares all its variables.
*/

/* ── FUNCTION: updateStatDisplay() ──────────────────────────
   Refreshes ALL stat counter elements across all tabs.
   Called after every test tick and every bug event. */
function updateStatDisplay() {
  var solved  = resolvedCount;
  var active  = activeBugIds.length;
  var total   = bugCount;
  var inputs  = testCount;
  var pct     = total>0 ? Math.round(solved/total*100) : 0;

  /* Fuzzing Engine tab */
  setEl('f-sent',   inputs.toLocaleString());
  setEl('f-found',  total);
  setEl('f-active', active);
  setEl('f-resolved', solved);

  /* Bug Analytics tab */
  setEl('a-sent',   inputs.toLocaleString());
  setEl('a-found',  total);
  setEl('a-resolved', solved);
  setEl('a-active', active);
  setEl('a-res-pct', pct+'% resolved');

  /* Sidebar Live Monitor */
  setEl('sb-total',   total);
  setEl('sb-solved',  solved);
  setEl('sb-unsolved', active);
  setBarW('sb-bar-solved',   total>0 ? (solved/total*100) : 0);
  setBarW('sb-bar-unsolved', total>0 ? (active/total*100) : 0);
  setEl('sb-pct-solved',   (total>0?Math.round(solved/total*100):0)+'%');
  setEl('sb-pct-unsolved', (total>0?Math.round(active/total*100):0)+'%');

  /* Progress bars */
  var fp = urlTargets.length>0 ? Math.min(urlProgress/urlTargets.length*100,100) : 0;
  setBarW('f-prog', fp);
  setEl('f-pct', Math.round(fp)+'%');
  setBarW('a-bug-prog', Math.min(total,100));
  setBarW('a-res-prog', pct);

  /* Nav bug badge */
  var nb = document.getElementById('nb-found');
  if (nb) { nb.textContent=total; nb.style.display=total>0?'flex':'none'; }

  /* Update analytics charts from dashboard.html inline script */
  if (typeof updateAnalyticsCharts === 'function') {
    updateAnalyticsCharts(bugCount, resolvedCount, activeBugIds);
  }

  /* Persist all-time stats (sessions/bugs/inputs) periodically.
     Piggy-backing on this function — which already runs on every
     engine tick — instead of saving on every single increment,
     so localStorage isn't written dozens of times per second at
     fast fuzzing speeds. */
  if (typeof saveAllTimeStats === 'function') saveAllTimeStats();
}


/* ── HELPER: setEl() ─────────────────────────────────────── */
function setEl(id, val) {
  var e = document.getElementById(id); if(e) e.textContent = val;
}

/* ── HELPER: setBarW() ──────────────────────────────────────
   Sets progress bar width, clamped between 0 and 100%. */
function setBarW(id, pct) {
  var e = document.getElementById(id);
  if (e) e.style.width = Math.min(Math.max(pct,0),100)+'%';
}


/* ── FUNCTION: checkCompletion() ────────────────────────────
   Called after 5+ full URL iterations.
   Phase 1: Stop new tests.
   Phase 2A: If Auto-resolve Bugs is ON  → drain all active bugs
             one by one, then enter STABLE mode.
   Phase 2B: If Auto-resolve Bugs is OFF → do NOT touch active
             bugs. Engine still finishes (no more new tests),
             but stays in a "COMPLETE — bugs unsolved" state,
             not STABLE. Bugs only move to solved if the user
             manually turns Auto-resolve back ON afterwards. */
function checkCompletion() {
  if (!engineRunning) return;

  /* Stop all test/bug/terminal timers — no new tests or bugs,
     regardless of the Auto-resolve setting */
  clearInterval(testInterval);  testInterval=null;
  clearInterval(bugInterval);   bugInterval=null;
  clearInterval(termInterval);  termInterval=null;
  clearInterval(sessionTimer);  sessionTimer=null;
  clearInterval(pipelineTimer); pipelineTimer=null;
  engineRunning = false;

  logToTerminal('[ COMPLETE ] All '+urlTargets.length+' URLs tested — '+iteration+' iterations done.','#00e676');

  /* ── Auto-resolve is OFF: stop here, leave bugs exactly as they are ── */
  if (!settingAutoResolve) {
    logToTerminal('[ INFO ] Auto-resolve Bugs is OFF — '+activeBugIds.length+' bug(s) remain unsolved.','#ff9100');
    logToTerminal('[ INFO ] Turn ON "Auto-resolve Bugs" in Settings to resolve them.','#7a90ab');
    if (typeof wfLog==='function') wfLog('<span style="color:#ff9100">All tests done — Auto-resolve is OFF, '+activeBugIds.length+' bug(s) remain unsolved.</span>');
    _enterCompleteNotStableMode();
    return;
  }

  /* ── Auto-resolve is ON: drain bugs to stable as before ── */
  logToTerminal('[ DRAINING ] Resolving '+activeBugIds.length+' remaining active bug(s) before marking stable...','#ffd600');
  if (typeof wfLog==='function') wfLog('<span style="color:#ffd600">All tests done — draining '+activeBugIds.length+' active bug(s) to stable...</span>');

  /* If no active bugs at all, go straight to stable */
  if (activeBugIds.length === 0) {
    _enterStableMode();
    return;
  }

  /* Drain one bug every 600ms so HOD can see them being resolved */
  drainInterval = setInterval(function() {
    if (activeBugIds.length === 0) {
      clearInterval(drainInterval); drainInterval=null;
      _enterStableMode();
      return;
    }
    var rid = activeBugIds.shift(); /* Resolve oldest bug first (FIFO) */
    resolvedCount++;
    if (typeof moveBugToSolved==='function') moveBugToSolved(rid);
    logToTerminal('[ AUTO-RESOLVED ] Bug #'+rid+' resolved — '+activeBugIds.length+' remaining.','#00c853');
    updateStatDisplay();
  }, 600);
}

/* ── FUNCTION: _enterCompleteNotStableMode() ─────────────────
   Used when iterations finish but Auto-resolve Bugs is OFF.
   Engine stops sending new tests, but is explicitly NOT marked
   STABLE, since bugs are still unsolved — exporting/considering
   the session "done" only happens once Auto-resolve is turned
   ON and the remaining bugs are actually resolved. */
function _enterCompleteNotStableMode() {
  engineStarted = false;

  var badge = document.getElementById('liveBadge');
  var txt   = document.getElementById('liveTxt');
  if (badge) { badge.className='live-badge'; badge.style.background='#ff9100'; }
  if (txt)   txt.textContent = 'UNSOLVED';
  var dot = document.getElementById('sbDot');
  var st  = document.getElementById('sbStatus');
  if (dot) { dot.classList.remove('idle'); dot.style.background='#ff9100'; }
  if (st)  st.textContent = 'UNSOLVED';

  /* Re-enable Start button so user can Reset and try again,
     but do NOT show the green STABLE banner or enable Export —
     those are reserved for when bugs are actually all resolved. */
  var startBtnEl = document.getElementById('startBtn');
  if (startBtnEl) {
    startBtnEl.disabled = true;
    startBtnEl.style.opacity = '0.4';
    startBtnEl.textContent = '⚠ Bugs Unsolved';
  }

  if (typeof stopPipelineAnimation==='function') stopPipelineAnimation();
  if (typeof updateSessionStats==='function') updateSessionStats();
}

/* ── FUNCTION: _enterStableMode() ──────────────────────────
   Called after all active bugs are drained.
   Sets engineComplete=true, shows STABLE banner, enables Export. */
function _enterStableMode() {
  engineComplete = true;
  engineStarted  = false;

  /* Update all badges to STABLE */
  var badge = document.getElementById('liveBadge');
  var txt   = document.getElementById('liveTxt');
  if (badge) { badge.className='live-badge'; badge.style.background='#00c853'; }
  if (txt)   txt.textContent = 'STABLE';
  var dot = document.getElementById('sbDot');
  var st  = document.getElementById('sbStatus');
  if (dot) { dot.classList.remove('idle'); dot.style.background='#00c853'; }
  if (st)  st.textContent = 'STABLE';

  /* Show complete banner in dashboard */
  var cb = document.getElementById('completeBanner');
  if (cb) cb.style.display = 'flex';

  /* Disable Start button — must Reset to run again */
  var startBtnEl = document.getElementById('startBtn');
  if (startBtnEl) {
    startBtnEl.disabled = true;
    startBtnEl.style.opacity = '0.4';
    startBtnEl.textContent = '✅ Complete';
  }

  /* Show workflow complete state */
  if (typeof stopPipelineAnimation==='function') stopPipelineAnimation();
  logToTerminal('[ STABLE ] All bugs resolved. Active = 0. Session is STABLE.','#00e676');
  logToTerminal('[ EXPORT ] Click "📥 Export Report" to download your security report.','#5b9fff');
  if (typeof wfLog==='function') wfLog('<span style="color:#00e676">✅ STABLE — All '+resolvedCount+' bugs resolved. Click Export to download report.</span>');
  if (typeof updateSessionStats==='function') updateSessionStats();
}



/* ── FUNCTION: generateFinalReport() ────────────────────────
   Builds and downloads a .txt report.
   ONLY called when user clicks Export Report button — no auto-download. */
function generateFinalReport() {
  var now = new Date();
  var r = '=============================================================\n'
    + '   OSS FUZZING SECURITY REPORT\n'
    + '   University Post Graduate College (O.U.), Siddipet\n'
    + '=============================================================\n\n'
    + 'Student  : Kudikudi Akhil\n'
    + 'H.T. No. : 104324862027\n'
    + 'Course   : 2nd MCA IV Semester\n'
    + 'Guide    : U. Rajender\n'
    + 'HOD      : V. Chandra Shekhar\n\n'
    + 'Generated  : ' + now.toLocaleString() + '\n'
    + 'Speed Used : ' + currentSpeedName + ' (' + currentSpeedMs + 'ms)\n'
    + 'Tests Sent : ' + testCount.toLocaleString() + '\n'
    + 'URLs Tested: ' + urlTargets.length + '\n'
    + 'Bugs Found : ' + bugCount + '\n'
    + 'Resolved   : ' + resolvedCount + '\n'
    + 'Active     : ' + activeBugIds.length + '\n'
    + 'Resolution : ' + (bugCount>0?Math.round(resolvedCount/bugCount*100):0) + '%\n\n'
    + '--- URL TARGETS ---\n';
  urlTargets.forEach(function(u,i){ r += String(i+1).padStart(3,'0')+'. '+u+'\n'; });
  r += '\n=============================================================\nEND OF REPORT\n=============================================================\n';

  /* Create a downloadable Blob (file in memory) and trigger download */
  var blob = new Blob([r], {type:'text/plain'});
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'OSS_Report_'
    + now.getFullYear()
    + String(now.getMonth()+1).padStart(2,'0')
    + String(now.getDate()).padStart(2,'0') + '.txt';
  document.body.appendChild(link);
  link.click();                     /* Download triggered by user click only */
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);   /* Free the temporary URL from memory */

  logToTerminal('[ EXPORT ] Downloaded: "'+link.download+'"','#00e676');
  var em = document.getElementById('exportMsg');
  if (em) { em.style.display='block'; em.textContent='✓ Report exported! Check your Downloads folder.'; }
}



/* ── FUNCTION: detectBugs() ────────────────────────────────
   Runs every bugInterval tick. Randomly finds / resolves bugs.
   Respects settingAutoResolve — if OFF, bugs never auto-resolve. */
function detectBugs() {
  if (!engineRunning) return;
  var foundNew = false;
  if (Math.random() < 0.35) { /* 35% chance of finding a new bug */
    bugCount++; allTimeBugsFound++;
    activeBugIds.push(bugCount);
    foundNew = true;
    if (typeof addActiveBug === 'function') addActiveBug(bugCount);
    logToTerminal('[ BUG FOUND ] Vulnerability #'+bugCount+' detected!','#ff5252');
    if (typeof wfLog==='function') wfLog('<span style="color:#ff5252">Bug #'+bugCount+' found — type: '+randomBugType()+'</span>');
  }
  /* Auto-resolve only when setting is ON */
  if (settingAutoResolve && activeBugIds.length>0 && Math.random()<0.2) {
    var rid = activeBugIds.shift(); /* Remove oldest bug (FIFO order) */
    resolvedCount++;
    if (typeof moveBugToSolved==='function') moveBugToSolved(rid);
    logToTerminal('[ RESOLVED ] Bug #'+rid+' patched via mutation feedback.','#00c853');
  }
  /* Refresh sidebar heartbeat with spike if new bug found */
  if (typeof updateSidebarCharts==='function') updateSidebarCharts(foundNew);
  updateStatDisplay();
  if (typeof updateSessionStats==='function') updateSessionStats();
}


/* ── FUNCTION: terminalLogs() ───────────────────────────────
   Prints realistic log messages every termInterval tick.
   Only runs if settingTerminalLogging is ON. */
function terminalLogs() {
  if (!settingTerminalLogging || !engineRunning) return;
  var tgt = urlTargets.length>0
    ? urlTargets[Math.floor(Math.random()*urlTargets.length)]
    : 'https://target.example.com';
  var msgs = [
    '[ FUZZ ] Sending payload to '+tgt.slice(0,55),
    '[ TEST ] Buffer overflow probe → '+tgt.slice(0,45),
    '[ SCAN ] Mutating input — length:'+(Math.floor(Math.random()*9000)+500),
    '[ EXEC ] Null-byte injection → '+tgt.slice(0,45),
    '[ PROB ] Boundary test: '+(Math.pow(2,31)-1),
    '[ MUT  ] Format string: %s%s%n → sent',
    '[ COV  ] Coverage: '+(Math.floor(Math.random()*40)+55)+'% paths explored',
    '[ AFL  ] New code path discovered in binary'
  ];
  if (settingBoundaryFuzzing) {
    msgs.push('[ BOUND ] Edge case: max='+Math.pow(2,32));
    msgs.push('[ BOUND ] INT_MIN probe: '+(-Math.pow(2,31)));
  }
  if (settingMutationFeedback) {
    msgs.push('[ FEED  ] Re-fuzzing crash path #'+Math.floor(Math.random()*100));
  }
  logToTerminal(msgs[Math.floor(Math.random()*msgs.length)],
    Math.random()>0.5 ? '#3d5068' : '#7a90ab');
}


/* ── FUNCTION: logToTerminal() ──────────────────────────────
   Appends a coloured timestamped line to the terminal.
   Auto-scrolls only if settingAutoScroll is ON. */
function logToTerminal(text, colour) {
  var term = document.getElementById('terminal');
  if (!term) return;
  term.innerHTML += '<span style="color:'+(colour||'#7a90ab')+'">'
    + '['+new Date().toLocaleTimeString()+'] '+text+'</span><br>';
  /* Trim to last 180 lines to prevent memory overuse */
  if (term.querySelectorAll('br').length > 200) {
    var parts = term.innerHTML.split('<br>');
    term.innerHTML = parts.slice(-180).join('<br>');
  }
  if (settingAutoScroll) term.scrollTop = term.scrollHeight;
}


/* ── FUNCTION: setBadgeRunning() ────────────────────────────
   Updates LIVE/PAUSED/IDLE badges in topbar and sidebar. */
function setBadgeRunning(isRunning) {
  var badge = document.getElementById('liveBadge');
  var txt   = document.getElementById('liveTxt');
  if (badge && txt) {
    badge.className = isRunning ? 'live-badge' : 'live-badge idle';
    txt.textContent = isRunning ? 'LIVE' : (enginePaused ? 'PAUSED' : 'IDLE');
  }
  var dot = document.getElementById('sbDot');
  var st  = document.getElementById('sbStatus');
  if (dot && st) {
    if (isRunning) { dot.classList.remove('idle'); st.textContent='LIVE'; }
    else { dot.classList.add('idle'); st.textContent=enginePaused?'PAUSED':'IDLE'; }
  }
}


/* ── HELPER: randomBugType() ────────────────────────────────
   Returns a random bug type name for workflow log messages. */
function randomBugType() {
  var types=['Buffer Overflow','Null Pointer','Memory Leak','Integer Overflow','Use After Free'];
  return types[Math.floor(Math.random()*types.length)];
}
