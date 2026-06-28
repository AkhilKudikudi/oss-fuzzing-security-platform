/*
  FILE    : js/fuzzer2.js  (Part 2 of 2 — Settings, Stats, Pipeline, Bug Tables)
  PURPOSE : Settings toggles, session stats, pipeline animation,
            bug table rendering, and bug type counters.
  PART 1  : js/fuzzer.js — Engine core
  USED BY : dashboard.html

  HOW TO EXPLAIN TO HOD:
  "Sir, this is Part 2 of the engine. It handles all Settings
  toggles — when I click ON/OFF they actually change how the
  engine runs. It also draws bugs into the table and animates
  the pipeline workflow in the sidebar."
*/


/* ── FUNCTION: toggleSetting() ──────────────────────────────
   Called when any Settings toggle button is clicked.
   Flips the ON/OFF variable and updates button appearance.
   Each setting directly changes engine behaviour.

   key values:
   'mutation'  → settingMutationFeedback
   'autores'   → settingAutoResolve
   'terminal'  → settingTerminalLogging
   'boundary'  → settingBoundaryFuzzing
   'autoscroll'→ settingAutoScroll */
function toggleSetting(key) {
  var btn = document.getElementById('toggle-'+key);
  var newVal;

  if (key === 'mutation') {
    settingMutationFeedback = !settingMutationFeedback; /* Flip true/false */
    newVal = settingMutationFeedback;
    logToTerminal('[ SETTING ] Mutation Feedback Loop: '+(newVal?'ON':'OFF'),'#5b9fff');
  } else if (key === 'autores') {
    settingAutoResolve = !settingAutoResolve;
    newVal = settingAutoResolve;
    logToTerminal('[ SETTING ] Auto-resolve Bugs: '+(newVal?'ON':'OFF'),'#5b9fff');

    /* Turning Auto-resolve ON: if there are bugs sitting unsolved
       right now (from earlier while it was OFF), resolve them all
       immediately — this matches "when I click ON auto-resolve,
       the bugs in unsolved move to solved". Works whether the
       engine is still running or already finished. */
    if (newVal && typeof activeBugIds !== 'undefined' && activeBugIds.length > 0) {
      var countToResolve = activeBugIds.length;
      logToTerminal('[ AUTO-RESOLVE ] Resolving '+countToResolve+' previously unsolved bug(s)...','#00c853');
      while (activeBugIds.length > 0) {
        var rid = activeBugIds.shift();
        resolvedCount++;
        if (typeof moveBugToSolved === 'function') moveBugToSolved(rid);
      }
      if (typeof updateStatDisplay === 'function') updateStatDisplay();
      logToTerminal('[ AUTO-RESOLVE ] All bugs resolved — '+countToResolve+' bug(s) moved to solved.','#00c853');

      /* If the engine had already finished in the "unsolved" state
         (badge showing UNSOLVED, Export disabled), upgrade it to
         STABLE now that everything is actually resolved. */
      if (!engineRunning && typeof engineStarted !== 'undefined' && !engineStarted &&
          typeof _enterStableMode === 'function') {
        _enterStableMode();
      }
    }
  } else if (key === 'terminal') {
    settingTerminalLogging = !settingTerminalLogging;
    newVal = settingTerminalLogging;
    /* Log this one message even if logging was just turned off */
    logToTerminal('[ SETTING ] Terminal Logging: '+(newVal?'ON':'OFF'),'#5b9fff');
  } else if (key === 'boundary') {
    settingBoundaryFuzzing = !settingBoundaryFuzzing;
    newVal = settingBoundaryFuzzing;
    logToTerminal('[ SETTING ] Boundary Fuzzing: '+(newVal?'ON':'OFF'),'#5b9fff');
  } else if (key === 'autoscroll') {
    settingAutoScroll = !settingAutoScroll;
    newVal = settingAutoScroll;
    logToTerminal('[ SETTING ] Auto-scroll Terminal: '+(newVal?'ON':'OFF'),'#5b9fff');
  } else {
    return; /* Unknown key — do nothing */
  }

  /* Update button appearance: ON=green, OFF=grey */
  if (btn) {
    btn.classList.toggle('on',  newVal);  /* Add 'on' if newVal is true */
    btn.classList.toggle('off', !newVal); /* Add 'off' if newVal is false */
  }

  updateEngineControlDisplay(); /* Refresh strategy label in info bar */
}


/* ── FUNCTION: updateSessionStats() ─────────────────────────
   Refreshes the Session Statistics panel in Settings tab.
   Shows all-time data accumulated across all sessions. */
function updateSessionStats() {
  setEl('stat-sessions',  allTimeSessions);
  setEl('stat-allbugs',   allTimeBugsFound);
  setEl('stat-allinputs', allTimeInputsSent.toLocaleString());
}


/* ── FUNCTION: clearSessionStats() ──────────────────────────
   Called by Clear Session button in Settings tab.
   Resets ONLY the all-time statistics counters to zero.
   Does NOT stop the engine or clear bugs. */
function clearSessionStats() {
  allTimeSessions   = 0;  /* Reset session count to zero */
  allTimeBugsFound  = 0;  /* Reset all-time bug count to zero */
  allTimeInputsSent = 0;  /* Reset all-time input count to zero */
  if (typeof saveAllTimeStats === 'function') saveAllTimeStats(); /* Persist the zeros */
  updateSessionStats();   /* Refresh display to show zeros */
  logToTerminal('[ SESSION ] All-time session statistics cleared to zero.','#ffd600');
}


/* ── PIPELINE ANIMATION (Sidebar) ───────────────────────────
   The pipeline in the sidebar shows the 6 processing steps.
   Steps animate one by one while the engine runs:
   Target OSS → Fuzzing Engine → Exec Monitor →
   Bug Classifier → Dashboard → Mutation Loop
   Each step glows cyan (active), then turns green (done). */
var pipelineTimer  = null;  /* Timer handle for pipeline animation */
var pipelineStep   = 0;     /* Current active step index (0 to 5) */

/* startPipelineAnimation — starts the step-by-step animation */
function startPipelineAnimation() {
  pipelineStep = 0;
  clearInterval(pipelineTimer); /* Clear any existing animation */
  pipelineTimer = setInterval(advancePipelineStep, 2500); /* Every 2.5 seconds */
  advancePipelineStep(); /* Show first step immediately */
}

/* stopPipelineAnimation — stops animation, marks all steps done */
function stopPipelineAnimation() {
  clearInterval(pipelineTimer);
  pipelineTimer = null;
  for (var i=0; i<=5; i++) {
    var d=document.getElementById('pd'+i); /* Pipeline dot */
    var l=document.getElementById('pl'+i); /* Pipeline line */
    var t=document.getElementById('pt'+i); /* Pipeline text */
    if (d) { d.classList.remove('active'); d.classList.add('done'); }
    if (l) l.classList.add('done');
    if (t) { t.classList.remove('active'); t.classList.add('done'); }
  }
  /* Also stop workflow tab animation */
  if (typeof advanceWorkflow === 'function') advanceWorkflow(6);
}

/* advancePipelineStep — moves the active dot to the next step */
function advancePipelineStep() {
  for (var i=0; i<=5; i++) {
    var d=document.getElementById('pd'+i);
    var l=document.getElementById('pl'+i);
    var t=document.getElementById('pt'+i);
    if (i < pipelineStep) {
      /* Steps before current = done (green) */
      if(d){ d.classList.remove('active'); d.classList.add('done'); }
      if(l) l.classList.add('done');
      if(t){ t.classList.remove('active'); t.classList.add('done'); }
    } else if (i === pipelineStep) {
      /* Current step = active (cyan glow) */
      if(d){ d.classList.add('active'); d.classList.remove('done'); }
      if(t){ t.classList.add('active'); t.classList.remove('done'); }
    } else {
      /* Future steps = not yet reached */
      if(d) d.classList.remove('active','done');
      if(t) t.classList.remove('active','done');
    }
  }
  /* Also update the main workflow tab */
  if (typeof advanceWorkflow === 'function') advanceWorkflow(pipelineStep);
  /* Log step name to workflow terminal */
  var stepNames = ['Target OSS loaded','Fuzzing Engine active','Exec Monitor watching',
    'Bug Classifier running','Dashboard updating','Mutation Loop re-fuzzing'];
  if (typeof wfLog === 'function' && stepNames[pipelineStep]) {
    wfLog('<span style="color:#00e5ff">Pipeline Step '+(pipelineStep+1)+': '+stepNames[pipelineStep]+'</span>');
  }
  pipelineStep = (pipelineStep + 1) % 6; /* Cycle 0→1→2→3→4→5→0 */
}


/* ── BUG TYPE DATA ──────────────────────────────────────────
   Arrays used to randomly assign type and severity to each bug.
   pieData tracks counts per type for the pie chart. */
var BUG_TYPES = [
  'Buffer Overflow', 'Null Pointer Dereference', 'Memory Leak',
  'Integer Overflow', 'Use After Free', 'Format String', 'Heap Overflow'
];
var BUG_SEVS  = ['Critical', 'High', 'Medium'];
var SEV_COLS  = { Critical:'#ff1744', High:'#ff9100', Medium:'#ffd600' };


/* ── FUNCTION: addActiveBug() ───────────────────────────────
   Adds a new bug row to the Fuzzing Engine and Analytics tables.
   Called by detectBugs() in fuzzer.js when a new bug is found. */
function addActiveBug(id) {
  var type = BUG_TYPES[Math.floor(Math.random()*BUG_TYPES.length)];
  var sev  = BUG_SEVS[Math.floor(Math.random()*BUG_SEVS.length)];
  var col  = SEV_COLS[sev] || '#ffd600';
  var url  = urlTargets.length>0
    ? urlTargets[(id-1) % urlTargets.length].slice(0,35)+'...'
    : 'target.bin';
  var inputs = ['\\x00\\x00\\xff\\xfe','AAAA...AAAA(256)','%s%s%n','2147483648','-1(0xFFFF)'];
  var inp = inputs[Math.floor(Math.random()*inputs.length)];

  /* Build a table row for the Fuzzing Engine tab */
  var row = document.createElement('tr');
  row.id  = 'bug-row-'+id;
  row.setAttribute('data-bugid', id);  /* Used by filterBugs() */
  row.innerHTML =
    '<td><span style="color:var(--cyan);font-family:\'JetBrains Mono\',monospace;font-size:11px">BUG-'+String(id).padStart(3,'0')+'</span></td>'
    +'<td style="font-size:11px">'+type+'</td>'
    +'<td><span style="color:'+col+';font-weight:700;font-size:11px">'+sev+'</span></td>'
    +'<td style="font-family:\'JetBrains Mono\',monospace;font-size:10px">'+inp+'</td>'
    +'<td style="color:var(--text3);font-size:10px">'+url+'</td>'
    +'<td><span class="status-badge active" id="bugstat-'+id+'">🔴 Active</span></td>';

  /* Remove placeholder row if it exists */
  var tbody = document.getElementById('fuzz-tbody');
  if (tbody) {
    var placeholder = tbody.querySelector('td[colspan]');
    if (placeholder) tbody.innerHTML = '';
    tbody.prepend(row); /* Add to top — newest bug first */
  }

  /* Mirror the same row in Analytics tab */
  var arow = row.cloneNode(true);
  arow.querySelector('.status-badge').id = 'abugstat-'+id;
  var atbody = document.getElementById('analytics-tbody');
  if (atbody) {
    var aph = atbody.querySelector('td[colspan]');
    if (aph) atbody.innerHTML = '';
    atbody.prepend(arow);
  }

  /* Update Bug Types sub-tables and counters */
  updateBugTypeCounters(type, sev, id, url);

  /* Update pieData for live pie chart */
  updatePieData(type);
}


/* ── FUNCTION: moveBugToSolved() ────────────────────────────
   Changes a bug's status badge from Active to Resolved.
   Called by detectBugs() in fuzzer.js when auto-resolve fires,
   and by drainInterval in checkCompletion(). */
function moveBugToSolved(id) {
  /* Update main table badge */
  var badge = document.getElementById('bugstat-'+id);
  if (badge) {
    badge.textContent = '✅ Resolved';
    badge.className   = 'status-badge resolved';
  }
  /* Update analytics table badge */
  var abadge = document.getElementById('abugstat-'+id);
  if (abadge) {
    abadge.textContent = '✅ Resolved';
    abadge.className   = 'status-badge resolved';
  }
  /* Also update the bug-type sub-tab resolved/active counters.
     Find which sub-table this bug's row is in by scanning tbody ids. */
  ['bof','mem','null','int'].forEach(function(prefix) {
    var tbody = document.getElementById(prefix+'-tbody');
    if (!tbody) return;
    /* Each row's first cell contains BUG-XXX — find matching row */
    var rows = tbody.querySelectorAll('tr');
    rows.forEach(function(row) {
      var firstCell = row.cells && row.cells[0];
      if (!firstCell) return;
      if (firstCell.textContent.trim() === 'BUG-'+String(id).padStart(3,'0')) {
        /* Decrement active, increment resolved for this prefix */
        var act = document.getElementById(prefix+'-active');
        var res = document.getElementById(prefix+'-resolved');
        if (act) { var av=parseInt(act.textContent||0); if(av>0) act.textContent=av-1; }
        if (res) { res.textContent=parseInt(res.textContent||0)+1; }
      }
    });
  });
}


/* ── FUNCTION: updateBugTypeCounters() ──────────────────────
   Updates the totals and sub-tables in the Bug Types tab.
   Maps bug type name to a tab prefix (bof/mem/null/int). */
function updateBugTypeCounters(type, sev, id, url) {
  /* Decide which Bug Types sub-section this bug belongs to */
  var prefix = {
    'Buffer Overflow':'bof','Heap Overflow':'bof',
    'Memory Leak':'mem','Use After Free':'mem',
    'Null Pointer Dereference':'null',
    'Integer Overflow':'int','Format String':'int'
  }[type] || 'bof';

  /* Increment the total and active counters for that section */
  var tot = document.getElementById(prefix+'-total');
  var act = document.getElementById(prefix+'-active');
  if (tot) tot.textContent = parseInt(tot.textContent||0)+1;
  if (act) act.textContent = parseInt(act.textContent||0)+1;

  /* Add a row to the sub-table inside that Bug Types section */
  var tbody = document.getElementById(prefix+'-tbody');
  if (tbody) {
    var col = SEV_COLS[sev]||'#ffd600';
    var row = document.createElement('tr');
    row.innerHTML =
      '<td style="font-family:\'JetBrains Mono\',monospace;font-size:10px">BUG-'+String(id).padStart(3,'0')+'</td>'
      +'<td style="font-size:11px">'+type+'</td>'
      +'<td><span style="color:'+col+';font-size:11px;font-weight:700">'+sev+'</span></td>'
      +'<td style="color:var(--text3);font-size:10px">'+(url||'target.bin')+'</td>';
    tbody.appendChild(row); /* Append to bottom of sub-table */
  }

  /* Update severity bar chart in analytics */
  if (typeof analyticsCharts !== 'undefined' && analyticsCharts['sevChart']) {
    var sevIdx = {Critical:0, High:1, Medium:2}[sev];
    if (sevIdx !== undefined) {
      analyticsCharts['sevChart'].data.datasets[0].data[sevIdx]++;
      analyticsCharts['sevChart'].update('none'); /* Redraw without animation */
    }
  }
}


/* ── FUNCTION: updatePieData() ──────────────────────────────
   Updates the pieData object that the pie charts read from.
   Called every time a new bug is found. */
function updatePieData(type) {
  /* Map bug type to pie chart category */
  if (['Buffer Overflow','Heap Overflow'].includes(type)) pieData.bof++;
  else if (['Memory Leak','Use After Free'].includes(type)) pieData.mem++;
  else if (type === 'Null Pointer Dereference') pieData.nul++;
  else if (['Integer Overflow','Format String'].includes(type)) pieData.int++;
}


/* ── FUNCTION: filterBugs() ─────────────────────────────────
   Called by All / Unsolved / Solved filter buttons.
   Shows or hides bug table rows based on their status badge. */
function filterBugs(filter) {
  var tbody = document.getElementById('fuzz-tbody');
  if (!tbody) return;
  var rows = tbody.querySelectorAll('tr[data-bugid]');
  rows.forEach(function(row) {
    var badge = row.querySelector('.status-badge');
    if (!badge) { row.style.display=''; return; }
    var isActive   = badge.classList.contains('active');
    var isResolved = badge.classList.contains('resolved');
    /* Show or hide based on selected filter */
    if      (filter==='all')      row.style.display = '';
    else if (filter==='active')   row.style.display = isActive   ? '' : 'none';
    else if (filter==='resolved') row.style.display = isResolved ? '' : 'none';
  });
}
