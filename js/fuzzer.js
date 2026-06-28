/*
  FILE    : js/fuzzer.js  (Engine Core — Part 1 of 2)
  PURPOSE : Start, Pause, Continue, Stop, Reset the fuzzing engine.
            Sends random test inputs to uploaded URL targets.
  PART 2  : js/fuzzer2.js — Settings, Themes, Stats, Pipeline
  USED BY : dashboard.html

  HOW TO EXPLAIN TO HOD:
  "Sir, this is the Fuzzing Engine module Part 1.
  It handles all engine states — Start, Pause, Continue, Stop,
  and Reset. All timers and counters are managed here.
  The speed changes are clearly visible in the terminal output."
*/

/* ── ENGINE STATE FLAGS ─────────────────────────────────────
   These four flags track exactly what the engine is doing.
   All functions check these before doing anything. */
var engineRunning  = false;  /* true = engine is actively running */
var engineStarted  = false;  /* true = engine was started at least once */
var enginePaused   = false;  /* true = engine is in paused state */
var engineStopped  = false;  /* true = engine was hard-stopped (cannot resume) */
var engineComplete = false;  /* true = all tests done + all bugs resolved = STABLE */

/* ── TIMER HANDLES ──────────────────────────────────────────
   setInterval() returns a handle — we store it to stop the timer later.
   clearInterval(handle) stops the repeating timer. */
var testInterval  = null;   /* Timer for sendTests() function */
var bugInterval   = null;   /* Timer for detectBugs() function */
var termInterval  = null;   /* Timer for terminalLogs() function */
var sessionTimer  = null;   /* Timer for the session clock */
var drainInterval = null;   /* Timer for draining active bugs on completion */

/* ── COUNTERS ───────────────────────────────────────────────
   These track all the numbers shown on the dashboard. */
var testCount      = 0;     /* Total random inputs sent to URLs */
var bugCount       = 0;     /* Total bugs found in this session */
var activeBugIds   = [];    /* Array of bug IDs not yet resolved */
var resolvedCount  = 0;     /* Number of bugs auto-resolved */
var sessionSeconds = 0;     /* How many seconds engine has run */
var iteration      = 0;     /* How many full URL-list loops done */
var urlProgress    = 0;     /* Index of URL currently being tested */
var urlTargets     = [];    /* Array of URL strings from uploaded file */
var fileLabel      = '';    /* Filename shown in topbar chip */

/* ── SETTINGS FLAGS ─────────────────────────────────────────
   Toggled ON/OFF from the Settings tab. Each one changes behaviour. */
var settingMutationFeedback = true;  /* Use crash inputs as re-fuzz seeds */
var settingAutoResolve      = true;  /* Auto-mark bugs resolved */
var settingTerminalLogging  = true;  /* Print logs to terminal */
var settingBoundaryFuzzing  = true;  /* Test INT_MAX, empty strings etc. */
var settingAutoScroll       = true;  /* Auto-scroll terminal to bottom */

/* ── ALL-TIME STATS ─────────────────────────────────────────
   These accumulate across all sessions until Clear is clicked.
   Saved to localStorage so they survive page reloads and even
   closing/reopening the browser — true "all-time" totals, not
   just totals since the last page load. */
var allTimeSessions   = parseInt(localStorage.getItem('ossFuzzAllTimeSessions'))   || 0;
var allTimeBugsFound  = parseInt(localStorage.getItem('ossFuzzAllTimeBugsFound'))  || 0;
var allTimeInputsSent = parseInt(localStorage.getItem('ossFuzzAllTimeInputsSent')) || 0;

/* ── FUNCTION: saveAllTimeStats() ────────────────────────────
   Persists the three all-time counters to localStorage.
   Called any time one of them changes, so a reload or browser
   restart never loses the running totals. */
function saveAllTimeStats() {
  localStorage.setItem('ossFuzzAllTimeSessions',   allTimeSessions);
  localStorage.setItem('ossFuzzAllTimeBugsFound',  allTimeBugsFound);
  localStorage.setItem('ossFuzzAllTimeInputsSent', allTimeInputsSent);
}

/* ── SPEED MAP ──────────────────────────────────────────────
   Maps speed name to milliseconds between each engine tick.
   Slow=2000ms (clearly slow), Turbo=80ms (clearly very fast).
   setInterval(fn, ms) calls fn every ms milliseconds. */
var SPEED_MAP = { slow:2000, normal:700, fast:250, turbo:80 };
var currentSpeedMs   = 700;       /* Active speed in ms (default: Normal) */
var currentSpeedName = 'Normal';  /* Speed label shown in terminal */


/* ── FUNCTION: initDashboard() ──────────────────────────────
   Called on page load (window.onload in dashboard.html).
   Checks login, reads URL data from sessionStorage, sets topbar. */
function initDashboard() {
  guardPage();                       /* Redirect to login if not logged in */
  setTopbar(getLoggedInUser());      /* Show user name + initial in topbar */

  /* Read file data saved by upload.js in Step 2 */
  fileLabel  = sessionStorage.getItem('ossFuzzFile')     || 'No file';
  var urlStr = sessionStorage.getItem('ossFuzzURLs')     || '';
  var urlCnt = sessionStorage.getItem('ossFuzzURLCount') || '0';

  /* Convert the stored newline-separated URL string back to an array */
  urlTargets = urlStr
    ? urlStr.split('\n').filter(function(u){ return u.trim(); })
    : [];

  /* Show the filename chip in the topbar area */
  var chip = document.getElementById('fileChip');
  var chipName = document.getElementById('fileChipName');
  if (chip && chipName && urlTargets.length > 0) {
    chipName.textContent = fileLabel;
    chip.style.display = 'flex';
  }

  /* Show URL count badge in the engine info bar */
  var badge = document.getElementById('urlCountBadge');
  if (badge) badge.textContent = urlTargets.length + ' URLs loaded';

  /* Print the loaded URLs into the terminal after 500ms */
  setTimeout(function(){
    printFileToTerminal(urlTargets, fileLabel, urlCnt);
  }, 500);
}


/* ── FUNCTION: printFileToTerminal() ────────────────────────
   Shows the loaded URLs in the terminal when page loads.
   Prints first 10 URLs with line numbers for HOD to see. */
function printFileToTerminal(urls, name, count) {
  var term = document.getElementById('terminal');
  if (!term) return;
  if (urls.length === 0) {
    term.innerHTML += '<span style="color:#ff9100">[ WARNING ] No URLs loaded. Go back and upload a file.</span><br>';
    return;
  }
  term.innerHTML += '<span style="color:#5b9fff">[ FILE LOADED ] ' + name + ' — ' + count + ' URLs</span><br>';
  term.innerHTML += '<span style="color:#7a90ab">[ SCAN ] Extracting fuzzable URL targets...</span><br>';
  /* slice(0,10) takes only the first 10 items from the array */
  urls.slice(0, 10).forEach(function(url, i) {
    term.innerHTML += '<span style="color:#3d5068">[' + String(i+1).padStart(3,'0') + ']</span> '
      + '<span style="color:#ffd600">' + url.slice(0, 70) + '</span><br>';
  });
  if (urls.length > 10) {
    term.innerHTML += '<span style="color:#3d5068">... and ' + (urls.length-10) + ' more URLs loaded.</span><br>';
  }
  term.innerHTML += '<span style="color:#00e676">[ READY ] Press ▶ Start Fuzzing to begin.</span><br>';
  if (settingAutoScroll) term.scrollTop = term.scrollHeight;
}


/* ── FUNCTION: openAddFilesDialog() ─────────────────────────
   Opens file picker. Can be called while engine is running.
   Supports multiple file selection. Checks for duplicates. */
function openAddFilesDialog() {
  var input = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.txt,.csv,.json';
  input.multiple = true; /* Allow selecting several files at once */
  input.onchange = function(e) {
    /* Convert FileList to array and process each file */
    Array.from(e.target.files).forEach(function(f){
      handleDashboardFile(f);
    });
  };
  input.click(); /* Open the OS file picker dialog */
}


/* ── FUNCTION: handleDashboardFile() ────────────────────────
   Validates and merges one file into urlTargets.
   Shows duplicate error if same file is added again. */
function handleDashboardFile(file) {
  var ext = file.name.split('.').pop().toLowerCase();
  if (!['txt','csv','json'].includes(ext)) {
    logToTerminal('[ ERROR ] "'+file.name+'" — only .txt .csv .json allowed.','#ff5252');
    alert('"'+file.name+'" was rejected — only .txt, .csv, .json files are allowed.');
    return;
  }
  if (file.size === 0) {
    logToTerminal('[ ERROR ] "'+file.name+'" is empty.','#ff5252');
    alert('"'+file.name+'" is empty — please choose a file that contains URLs.');
    return;
  }
  /* Track added files to detect duplicates */
  if (!window._dashFiles) window._dashFiles = [];
  var isDup = window._dashFiles.some(function(f){
    return f.name === file.name && f.size === file.size;
  });
  if (isDup) {
    /* Show duplicate error as required */
    logToTerminal('[ DUPLICATE ] "'+file.name+'" already added! This file already exists.','#ff9100');
    alert('"'+file.name+'" already added! This file already exists.');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var result;
    try {
      /* extractRowsFromText() + validateRows() are defined in upload.js —
         same two-step pipeline the Upload page uses, so validation rules
         stay identical everywhere in the project. */
      var rows = extractRowsFromText(text, ext);
      result = validateRows(rows);
    } catch (err) {
      logToTerminal('[ ERROR ] "'+file.name+'" could not be read: '+err.message,'#ff5252');
      alert('"'+file.name+'" could not be read: '+err.message);
      return;
    }
    if (!result.valid) {
      logToTerminal('[ ERROR ] "'+file.name+'" rejected: '+result.reason,'#ff5252');
      alert('"'+file.name+'" rejected: '+result.reason);
      return;
    }
    var added = 0;
    result.urls.forEach(function(url){
      if (!urlTargets.includes(url)){ urlTargets.push(url); added++; }
    });
    window._dashFiles.push({name:file.name, size:file.size});
    sessionStorage.setItem('ossFuzzURLs', urlTargets.join('\n'));
    sessionStorage.setItem('ossFuzzURLCount', String(urlTargets.length));
    var badge = document.getElementById('urlCountBadge');
    if (badge) badge.textContent = urlTargets.length + ' URLs loaded';
    logToTerminal('[ FILE ADDED ] "'+file.name+'" — '+added+' new URLs. Total: '+urlTargets.length,'#00e676');
  };
  reader.readAsText(file);
}


/* ── FUNCTION: toggleEngine() ───────────────────────────────
   Called when Start / Pause / Continue button is clicked.
   Decides which action based on current engine state. */
function toggleEngine() {
  if (engineComplete) return;              /* STABLE — do nothing, must Reset */
  if (!engineStarted || engineStopped) { startEngine();    } /* → Start */
  else if (engineRunning)              { pauseEngine();    } /* → Pause */
  else if (enginePaused)               { continueEngine(); } /* → Resume (pause only) */
}


/* ── FUNCTION: startEngine() ────────────────────────────────
   Starts engine fresh. Resets ALL counters to zero.
   Sets all state flags and starts all interval timers. */
function startEngine() {
  if (urlTargets.length === 0) {
    logToTerminal('[ ERROR ] No URLs loaded! Please go back and upload a URL file first.','#ff5252');
    return;
  }
  /* Reset all counters to starting values */
  engineRunning=true; engineStarted=true; enginePaused=false;
  engineStopped=false; engineComplete=false;
  testCount=0; bugCount=0; urlProgress=0; activeBugIds=[];
  resolvedCount=0; sessionSeconds=0; iteration=1;
  allTimeSessions++;
  saveAllTimeStats();
  clearInterval(drainInterval); drainInterval=null;

  updateEngineButton('pause'); /* Button shows ⏸ Pause Engine */
  setBadgeRunning(true);        /* Topbar badge shows LIVE */

  logToTerminal('[ ENGINE STARTED ] Fuzzing '+urlTargets.length+' URLs at '+currentSpeedName+' ('+currentSpeedMs+'ms).','#00e676');
  logToTerminal('[ STRATEGY ] AFL + LibFuzzer mutation-based fuzzing activated.','#7a90ab');

  /* Start all four timers */
  sessionTimer = setInterval(tickSessionClock,  1000);
  testInterval = setInterval(sendTests,         currentSpeedMs);
  bugInterval  = setInterval(detectBugs,        currentSpeedMs * 4);
  termInterval = setInterval(terminalLogs,      currentSpeedMs * 2);

  /* Start pipeline + workflow animations */
  if (typeof startPipelineAnimation === 'function') startPipelineAnimation();

  /* Log to workflow terminal */
  if (typeof wfLog === 'function') wfLog('<span style="color:#00e676">Engine started — fuzzing '+urlTargets.length+' targets.</span>');

  updateEngineControlDisplay();
  if (typeof updateSessionStats === 'function') updateSessionStats();
}


/* ── FUNCTION: pauseEngine() ────────────────────────────────
   Pauses engine. Clears all timers.
   testCount, bugCount, urlProgress are NOT reset — kept for resume. */
function pauseEngine() {
  engineRunning=false; enginePaused=true;
  /* clearInterval() stops each timer — null means no active timer */
  clearInterval(testInterval);  testInterval=null;
  clearInterval(bugInterval);   bugInterval=null;
  clearInterval(termInterval);  termInterval=null;
  clearInterval(sessionTimer);  sessionTimer=null;
  /* FREEZE pipeline/workflow at current step — do NOT advance */
  clearInterval(pipelineTimer); pipelineTimer=null;

  updateEngineButton('continue'); /* Button shows ▶ Continue */
  setBadgeRunning(false);          /* Badge shows PAUSED */

  logToTerminal('[ PAUSED ] Frozen at URL #'+urlProgress+', test #'+testCount.toLocaleString()+'.','#ffd600');
  logToTerminal('[ INFO ] Click ▶ Continue to resume from this exact point.','#7a90ab');
  if (typeof wfLog === 'function') wfLog('<span style="color:#ffd600">Engine PAUSED — workflow frozen at current step.</span>');
}


/* ── FUNCTION: continueEngine() ─────────────────────────────
   Resumes engine from the EXACT point it was paused.
   Does NOT reset counters — continues incrementing them. */
function continueEngine() {
  if (engineStopped || engineComplete) return; /* Hard stop / complete — cannot resume */
  engineRunning=true; enginePaused=false;
  /* Restart all timers at current speed — counters keep their values */
  sessionTimer = setInterval(tickSessionClock,  1000);
  testInterval = setInterval(sendTests,         currentSpeedMs);
  bugInterval  = setInterval(detectBugs,        currentSpeedMs * 4);
  termInterval = setInterval(terminalLogs,      currentSpeedMs * 2);
  /* Resume pipeline animation from the step it was frozen at */
  clearInterval(pipelineTimer);
  pipelineTimer = setInterval(advancePipelineStep, 2500);

  updateEngineButton('pause'); setBadgeRunning(true);
  logToTerminal('[ RESUMED ] Continuing from URL #'+urlProgress+', test #'+testCount.toLocaleString()+'.','#00e676');
  if (typeof wfLog === 'function') wfLog('<span style="color:#00e676">Engine RESUMED — workflow continuing from frozen step.</span>');
  updateEngineControlDisplay();
}


/* ── FUNCTION: stopEngine() ─────────────────────────────────
   HARD STOP — freezes everything permanently.
   Counters are NOT zeroed — they stay visible.
   Cannot resume after hard stop — must Reset to start again.
   engineStopped=true blocks continueEngine() and toggleEngine(). */
function stopEngine() {
  if (!engineStarted && !engineRunning && !enginePaused) return; /* Nothing to stop */
  engineRunning=false; engineStarted=false; enginePaused=false; engineStopped=true;
  /* Stop ALL timers including pipeline — hard freeze */
  clearInterval(testInterval);  testInterval=null;
  clearInterval(bugInterval);   bugInterval=null;
  clearInterval(termInterval);  termInterval=null;
  clearInterval(sessionTimer);  sessionTimer=null;
  clearInterval(pipelineTimer); pipelineTimer=null;
  clearInterval(drainInterval); drainInterval=null;

  /* NOTE: allTimeInputsSent and allTimeBugsFound are tracked LIVE
     (in sendTests() and detectBugs() respectively) as the engine
     runs — not added in a lump sum here. This way the all-time
     totals are correct no matter how the session ends: Hard Stop,
     natural completion, or anything else. Adding testCount/bugCount
     again here would double-count what was already tracked live. */

  updateEngineButton('start'); setBadgeRunning(false);
  /* Update badge to show STOPPED specifically */
  var txt = document.getElementById('liveTxt');
  if (txt) txt.textContent = 'STOPPED';
  var st = document.getElementById('sbStatus');
  if (st) st.textContent = 'STOPPED';

  logToTerminal('[ HARD STOP ] Engine stopped. Tests: '+testCount.toLocaleString()+', Bugs: '+bugCount+', Active: '+activeBugIds.length+'.','#ff5252');
  logToTerminal('[ INFO ] Counters preserved. Click ↺ Reset to start a new session.','#7a90ab');
  if (typeof wfLog === 'function') wfLog('<span style="color:#ff5252">[ HARD STOP ] Engine stopped — workflow frozen. Reset required to restart.</span>');
  if (typeof updateSessionStats === 'function') updateSessionStats();
}


/* ── FUNCTION: resetFuzzing() ───────────────────────────────
   Resets EVERYTHING to zero initial state.
   Clears all bugs, counters, tables, terminal, charts. */
function resetFuzzing() {
  /* Stop all timers first — including drain and pipeline */
  clearInterval(testInterval); clearInterval(bugInterval);
  clearInterval(termInterval); clearInterval(sessionTimer);
  clearInterval(drainInterval); clearInterval(pipelineTimer);

  /* Reset all state to initial values */
  engineRunning=false; engineStarted=false; enginePaused=false;
  engineStopped=false; engineComplete=false;
  testCount=0; bugCount=0; urlProgress=0; activeBugIds=[];
  resolvedCount=0; sessionSeconds=0; iteration=0;
  testInterval=bugInterval=termInterval=sessionTimer=drainInterval=pipelineTimer=null;

  updateEngineButton('start'); setBadgeRunning(false);
  /* Reset badge to IDLE — clear both text AND any inline background
     color left over from STABLE (green) or UNSOLVED (orange) states.
     setBadgeRunning() only toggles className, it does not clear
     inline style.background, so we clear that explicitly here. */
  var liveTxtEl = document.getElementById('liveTxt'); if (liveTxtEl) liveTxtEl.textContent='IDLE';
  var sbStEl    = document.getElementById('sbStatus'); if (sbStEl) sbStEl.textContent='IDLE';
  var liveBadgeEl = document.getElementById('liveBadge'); if (liveBadgeEl) liveBadgeEl.style.background='';
  var sbDotEl     = document.getElementById('sbDot');     if (sbDotEl)     sbDotEl.style.background='';
  /* Hide complete banner */
  var cb = document.getElementById('completeBanner'); if (cb) cb.style.display='none';
  /* Re-enable Start button (was disabled during drain/complete) */
  var startBtnEl = document.getElementById('startBtn');
  if (startBtnEl) { startBtnEl.disabled=false; startBtnEl.style.opacity='1'; startBtnEl.textContent='▶ Start Fuzzing'; }

  /* Reset all stat display elements to 0 */
  ['f-sent','f-found','f-active','f-resolved',
   'a-sent','a-found','a-resolved','a-active',
   'sb-total','sb-solved','sb-unsolved','nb-found']
  .forEach(function(id){
    var e=document.getElementById(id); if(e) e.textContent='0';
  });

  /* Reset progress bars */
  ['f-prog','a-bug-prog','a-res-prog','sb-bar-solved','sb-bar-unsolved']
  .forEach(function(id){
    var e=document.getElementById(id); if(e) e.style.width='0%';
  });

  /* Reset labels */
  setEl('f-pct','0%'); setEl('a-res-pct','0% resolved');
  setEl('sb-pct-solved','0%'); setEl('sb-pct-unsolved','0%');
  setEl('f-strategy','—'); setEl('f-iter','1'); setEl('f-time','00:00');

  /* Reset nav bug badge — hide it */
  var nb = document.getElementById('nb-found');
  if (nb) { nb.textContent='0'; nb.style.display='none'; }

  /* Clear terminal */
  var term = document.getElementById('terminal');
  if (term) {
    term.innerHTML =
      '<span style="color:#3d5068">[ RESET ] All data cleared. System is back to zero state.</span><br>'
      +'<span style="color:#3d5068">[ READY ] Press ▶ Start Fuzzing to begin a new session.</span><br>';
  }

  /* Clear workflow terminal */
  var wft = document.getElementById('wfTerminal');
  if (wft) wft.innerHTML = '<span style="color:#3d5068">[ Workflow Monitor ] Reset. Waiting for new session...</span><br>';

  /* Clear workflow chart data points so they start fresh next session */
  if (typeof analyticsCharts !== 'undefined') {
    ['wfThroughput','wfResRate'].forEach(function(id) {
      if (analyticsCharts[id]) {
        analyticsCharts[id].data.labels = [];
        analyticsCharts[id].data.datasets[0].data = [];
        analyticsCharts[id].update('none');
      }
    });
  }

  /* Clear bug tables */
  var tb=document.getElementById('fuzz-tbody');
  if(tb) tb.innerHTML='<tr><td colspan="6" style="color:var(--text3);text-align:center;padding:20px">No bugs found yet — Start engine to begin</td></tr>';
  var at=document.getElementById('analytics-tbody');
  if(at) at.innerHTML='<tr><td colspan="6" style="color:var(--text3);text-align:center;padding:20px">Start fuzzing to populate</td></tr>';

  /* Clear bug type sub-tables */
  ['bof-tbody','mem-tbody','null-tbody','int-tbody'].forEach(function(id){
    var e=document.getElementById(id); if(e) e.innerHTML='';
  });

  /* Reset bug type counters */
  ['bof','mem','null','int'].forEach(function(p){
    ['total','active','resolved'].forEach(function(s){
      var e=document.getElementById(p+'-'+s); if(e) e.textContent='0';
    });
  });

  /* Reset pie data */
  if (typeof pieData !== 'undefined') {
    pieData.bof=0; pieData.mem=0; pieData.nul=0; pieData.int=0;
  }

  /* Reset sidebar heartbeat chart data */
  if (typeof heartData !== 'undefined') {
    for (var i=0; i<heartData.length; i++) heartData[i]=0;
    if (typeof updateSidebarCharts==='function') updateSidebarCharts(false);
  }

  /* Reset workflow nodes in main tab */
  if (typeof resetWorkflowUI === 'function') resetWorkflowUI();

  /* Reset pipeline dots in sidebar */
  for (var j=0; j<=5; j++) {
    var pd=document.getElementById('pd'+j), pl=document.getElementById('pl'+j), pt=document.getElementById('pt'+j);
    if(pd){ pd.classList.remove('active','done'); }
    if(pl){ pl.classList.remove('done'); }
    if(pt){ pt.classList.remove('active','done'); }
  }

  var em=document.getElementById('exportMsg'); if(em) em.style.display='none';
  if (typeof updateSessionStats === 'function') updateSessionStats();
}


/* ── FUNCTION: updateEngineButton() ─────────────────────────
   Changes the Start/Pause/Continue button label and colour.
   'pause'    → yellow ⏸ Pause Engine
   'continue' → orange ▶ Continue
   'start'    → green  ▶ Start Fuzzing */
function updateEngineButton(state) {
  var btn = document.getElementById('startBtn');
  if (!btn) return;
  if (state==='pause') {
    btn.textContent='⏸ Pause Engine';
    btn.style.background='#ffd600'; btn.style.color='#000';
  } else if (state==='continue') {
    btn.textContent='▶ Continue';
    btn.style.background='#ff9100'; btn.style.color='#000';
  } else {
    btn.textContent='▶ Start Fuzzing';
    btn.style.background=''; btn.style.color='';
  }
}


/* ── FUNCTION: updateSpeed() ────────────────────────────────
   Called when speed dropdown changes. Updates ms and restarts timers.
   Speed change is immediately visible — terminal prints faster/slower. */
function updateSpeed(value) {
  currentSpeedMs   = SPEED_MAP[value] || 700;
  currentSpeedName = {slow:'Slow',normal:'Normal',fast:'Fast',turbo:'Turbo'}[value]||'Normal';
  var labels = {slow:'Slow (0.5x)',normal:'Normal (1x)',fast:'Fast (4x)',turbo:'Turbo (12x)'};
  setEl('f-speed-lbl', labels[value]||'Normal (1x)');
  if (engineRunning) {
    /* Restart timers at new speed — counters are NOT reset */
    clearInterval(testInterval); clearInterval(bugInterval); clearInterval(termInterval);
    testInterval = setInterval(sendTests,    currentSpeedMs);
    bugInterval  = setInterval(detectBugs,   currentSpeedMs*4);
    termInterval = setInterval(terminalLogs, currentSpeedMs*2);
    logToTerminal('[ SPEED ] Changed to '+labels[value]+' — '+currentSpeedMs+'ms interval.','#5b9fff');
  }
  updateEngineControlDisplay();
}


/* ── FUNCTION: sendTests() ──────────────────────────────────
   Runs every testInterval tick while engine is active.
   Increments testCount and advances urlProgress.
   Faster speed = more increments per tick = visibly more tests. */
function sendTests() {
  if (!engineRunning) return;
  /* Number of tests per tick depends on speed */
  var inc = currentSpeedMs<=80  ? Math.floor(Math.random()*500)+100
          : currentSpeedMs<=250 ? Math.floor(Math.random()*200)+50
          : currentSpeedMs<=700 ? Math.floor(Math.random()*100)+20
          :                       Math.floor(Math.random()*30)+5;
  testCount += inc;
  allTimeInputsSent += inc; /* Track live, same as allTimeBugsFound in detectBugs() —
                                this way the all-time total is correct whether the
                                session ends via Stop, Reset, or natural completion,
                                instead of only being added on stopEngine(). */
  urlProgress++;
  /* When all URLs tested once = one full iteration */
  if (urlProgress >= urlTargets.length && urlTargets.length > 0) {
    urlProgress = 0; iteration++;
    if (iteration > 5 && settingMutationFeedback) checkCompletion();
  }
  var el = document.getElementById('testCounter');
  if (el) el.textContent = testCount.toLocaleString();
  updateStatDisplay();
  updateEngineControlDisplay();
  /* Update sidebar heartbeat chart without bug */
  if (typeof updateSidebarCharts === 'function') updateSidebarCharts(false);
}


/* ── FUNCTION: tickSessionClock() ───────────────────────────
   Called every 1 second. Updates MM:SS session timer display. */
function tickSessionClock() {
  sessionSeconds++;
  var m = Math.floor(sessionSeconds/60);
  var s = sessionSeconds % 60;
  /* padStart(2,'0') adds leading zero: "5" → "05" */
  setEl('f-time', String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'));
}


/* ── FUNCTION: updateEngineControlDisplay() ─────────────────
   Updates the engine info bar: Strategy, Iteration, Speed, Session time. */
function updateEngineControlDisplay() {
  if (engineRunning) {
    var strat = 'AFL';
    if (settingBoundaryFuzzing)  strat += '+Boundary';
    if (settingMutationFeedback) strat += '+MutFeed';
    setEl('f-strategy', strat);
  } else if (!engineStarted) {
    setEl('f-strategy','—');
  }
  setEl('f-iter', iteration || 1);
  var labels = {slow:'Slow (0.5x)',normal:'Normal (1x)',fast:'Fast (4x)',turbo:'Turbo (12x)'};
  var key = Object.keys(SPEED_MAP).find(function(k){ return SPEED_MAP[k]===currentSpeedMs; })||'normal';
  setEl('f-speed-lbl', labels[key]);
}


