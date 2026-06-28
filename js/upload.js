/*
  ============================================================
  FILE    : js/upload.js
  PURPOSE : Handles file upload and URL validation for Step 2.
            Supports MULTIPLE file uploads — user can pick
            several files at once from the file dialog.
            Accepts: .csv, .xlsx, .xls, .json, .xml, .txt
            Only accepts files where every DATA row is a valid
            URL, domain, email, or web link.
            Rejects plain text (names, phone numbers, dates).

  HEADER ROW HANDLING:
  Row 1 of the file is inspected first. If it looks like a
  real URL / email / domain, it is treated as DATA (no header
  existed). If it does NOT look like one (e.g. "URL", "Email",
  "Links"), it is treated as a header row and skipped — every
  row after it is then validated as real data.

  MODULE  : Upload / Validation JavaScript
  USED BY : upload.html only

  HOW TO EXPLAIN TO HOD:
  "Sir, this module validates uploaded files. Since our project
  fuzzes web software, we only accept URLs and web links.
  Plain text like names or phone numbers are rejected. The
  module supports CSV, Excel, JSON, XML and plain text files,
  and automatically detects whether the first row is a header
  or actual data, so both formats work correctly."

  KEY CONCEPTS:
  - FileReader API : Browser built-in tool to read local files.
  - SheetJS (XLSX)  : Library that reads Excel binary files.
  - Regular Expression (Regex): A pattern to match text formats.
  - sessionStorage : Saves file data so dashboard.html can use it.
  - Array          : We collect all URLs from all files into one list.
  ============================================================
*/

/* ── MODULE STATE ───────────────────────────────────────────
   allFiles stores ALL validated file objects added by user.
   allURLs  stores ALL URLs collected from all uploaded files.
   These are module-level variables shared by all functions. */
var allFiles = [];   /* Array of validated file objects           */
var allURLs  = [];   /* Combined array of URLs from all files     */

/* ── FUNCTION: UPLOAD.initUpload() ──────────────────────────
   Called when upload.html page loads (window.onload).
   Sets up auth guard + topbar + drag-and-drop events. */
function initUpload() {

  /* Check login — redirects to login page if not logged in */
  guardPage(); /* guardPage() is defined in auth.js */

  /* Show the logged-in user's name in the topbar */
  var name = getLoggedInUser();
  setTopbar(name); /* setTopbar() is defined in auth.js */

  /* Set up drag-and-drop on the upload zone div */
  setupDragDrop();

  /* Size the background video wrapper to match the FULL page
     height (not just the screen), so the video covers the
     entire scrollable page edge-to-edge with no black gaps —
     see syncVideoBgHeight() below for why this is needed. */
  syncVideoBgHeight();
  window.addEventListener('resize', syncVideoBgHeight);
}

/* ── FUNCTION: UPLOAD.syncVideoBgHeight() ───────────────────
   Sets the background video wrapper's height (in pixels) to
   match the page's true scrollHeight, so the video fills the
   ENTIRE page — including parts only visible after scrolling
   down — not just the first screen.

   WHY THIS IS NEEDED:
   upload.html grows taller as content is added (e.g. after
   choosing a file, the file-list card appears, making the
   page longer). A plain CSS height:100% on an absolutely
   positioned element does not reliably track an auto-growing
   flex container's height across browsers, so we measure the
   real page height directly in JavaScript and apply it.

   Called once on page load, on every window resize, and again
   any time the page's content height might have changed (e.g.
   after a file is added/removed) so the video never lags
   behind a page that just got taller or shorter. */
function syncVideoBgHeight() {
  var wrap    = document.querySelector('.video-bg-wrap');
  var overlay = document.querySelector('.video-bg-overlay');
  if (!wrap && !overlay) return; /* This page has no video background */

  /* document.body.scrollHeight = the FULL rendered height of
     the page content, including parts below the fold. Math.max
     against innerHeight ensures short pages still cover the
     full visible screen even if content is shorter than that. */
  var fullHeight = Math.max(document.body.scrollHeight, window.innerHeight);

  if (wrap)    wrap.style.height    = fullHeight + 'px';
  if (overlay) overlay.style.height = fullHeight + 'px';
}

/* ── FUNCTION: UPLOAD.setupDragDrop() ───────────────────────
   Adds event listeners so the user can drag a file from their
   desktop and drop it onto the upload zone box.

   dragover  : fires while a file is dragged OVER the zone.
   dragleave : fires when the dragged file LEAVES the zone.
   drop      : fires when the user RELEASES the file over zone. */
function setupDragDrop() {
  var zone = document.getElementById('uploadZone'); /* The drop zone div */
  if (!zone) return; /* Exit if element not found */

  zone.addEventListener('dragover', function(e) {
    e.preventDefault();              /* Prevent browser opening the file */
    zone.classList.add('drag-over'); /* Highlight the zone               */
  });

  zone.addEventListener('dragleave', function() {
    zone.classList.remove('drag-over'); /* Remove highlight when file leaves */
  });

  zone.addEventListener('drop', function(e) {
    e.preventDefault();                 /* Prevent browser opening the file */
    zone.classList.remove('drag-over'); /* Remove drop highlight            */

    /* e.dataTransfer.files has all dropped files.
       We pass the full FileList to handleFiles(). */
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files); /* Process all dropped files */
    }
  });
}

/* ── FUNCTION: UPLOAD.handleFiles(fileList) ─────────────────
   Entry point when user selects files (single or multiple).
   Now processes MULTIPLE files at once from the FileList.
   Called from: the file <input> onchange AND drag-drop.

   STEP 2 FIX: Changed from handleFile(file) to handleFiles(files)
   so user can select many files in one go from file dialog. */
function handleFiles(fileList) {
  /* fileList is a FileList object — convert to array for looping.
     Array.from() converts any array-like object to a real array. */
  var files = Array.from(fileList);

  /* Process each file one by one using a loop */
  files.forEach(function(file) {
    handleOneFile(file); /* Process each individual file */
  });
}

/* ── FUNCTION: UPLOAD.handleOneFile(file) ───────────────────
   Processes a single file from the selected/dropped files.
   Steps:
     1. Validate file extension (.json / .csv / .txt)
     2. Validate file is not empty (size > 0)
     3. Check for duplicate files (same name + size)
     4. Read file text using FileReader
     5. Validate EVERY line is a URL/domain/email
     6. Add to allFiles list and update file list display */
function handleOneFile(file) {
  if (!file) return; /* Exit if file is undefined */

  clearMessages(); /* Clear previous messages before processing */

  /* STEP 1: Check file extension.
     file.name.split('.') splits by dot. .pop() gets last part.
     .toLowerCase() ensures 'TXT' and 'txt' both work. */
  var ext = file.name.split('.').pop().toLowerCase();
  var allowed = ['json', 'csv', 'txt', 'xlsx', 'xls', 'xml']; /* Accepted types */

  if (!allowed.includes(ext)) {
    showUploadErr('Invalid file type ".' + ext + '" in "' + file.name + '". Only .csv, .xlsx, .xls, .json, .xml, .txt allowed.');
    return; /* Stop processing this file */
  }

  /* STEP 2: Check file is not empty.
     file.size is the number of bytes. 0 bytes = empty file. */
  if (file.size === 0) {
    showUploadErr('File "' + file.name + '" is empty (0 bytes). Please upload a file with URLs inside.');
    return;
  }

  /* STEP 3: Duplicate check — compare filename AND size.
     STEP 2 FIX: If same file is uploaded again, show clear error. */
  var alreadyAdded = allFiles.some(function(f) {
    return f.name === file.name && f.size === file.size;
  });

  if (alreadyAdded) {
    /* Show "already exists" error as instructed */
    showUploadErr('⚠ File "' + file.name + '" already exists in the list! This file was already added.');
    return; /* Skip duplicate file */
  }

  /* STEP 4: Read the file using FileReader API.
     FileReader reads files asynchronously — it does not freeze
     the page. When reading is done, reader.onload is called.

     Excel files (.xlsx/.xls) are BINARY — we must read them as
     an ArrayBuffer and hand them to SheetJS to extract the cells.
     All other formats (csv/txt/json/xml) are plain text. */
  var reader = new FileReader();
  var isExcel = (ext === 'xlsx' || ext === 'xls');

  reader.onload = function(e) {
    var rows; /* Will hold an array of row-strings extracted from the file */

    try {
      if (isExcel) {
        /* SheetJS reads the binary Excel data into a workbook object */
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var firstSheetName = workbook.SheetNames[0];
        var sheet = workbook.Sheets[firstSheetName];
        /* sheet_to_json with header:1 gives us an array of arrays —
           one inner array per row, one entry per cell. We flatten
           each row down to a single string by joining its cells. */
        var sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        rows = sheetRows.map(function(rowArr) {
          return rowArr.join(' ').trim();
        });
      } else {
        var rawText = e.target.result;
        if (!rawText.trim()) {
          showUploadErr('File "' + file.name + '" content is blank. Please upload a file with URLs.');
          return;
        }
        rows = extractRowsFromText(rawText, ext);
      }
    } catch (parseErr) {
      showUploadErr('Could not read "' + file.name + '". The file may be corrupted or in an unexpected format. (' + parseErr.message + ')');
      return;
    }

    /* STEP 5: Strict validation with automatic header-row detection */
    var result = validateRows(rows);

    if (!result.valid) {
      showUploadErr('File "' + file.name + '": ' + result.reason);
      return;
    }

    /* STEP 6: File is valid — add to allFiles list */
    var fileObj = {
      name  : file.name,     /* Filename for display          */
      ext   : ext,           /* File extension (txt/csv/json) */
      size  : file.size,     /* File size in bytes            */
      urls  : result.urls,   /* Array of valid URLs found     */
      count : result.count   /* Number of valid URLs          */
    };

    /* .push() adds the new file object to our allFiles array */
    allFiles.push(fileObj);

    /* Add new URLs from this file to our combined allURLs array.
       We filter to avoid adding exact duplicate URLs. */
    result.urls.forEach(function(url) {
      if (!allURLs.includes(url)) {
        allURLs.push(url); /* Only add if not already in list */
      }
    });

    /* Update the file list display in the UI */
    renderFileList();

    /* Show success message for this file */
    showUploadSuc(
      '✓ "' + file.name + '" added — '
      + result.count + ' URLs found. '
      + 'Total: ' + allURLs.length + ' URLs ready.'
    );

    /* Show the Proceed button since we have at least one file */
    showProceed();
  };

  /* Start reading the file — binary mode for Excel, text mode otherwise */
  if (isExcel) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
  /* Reset the file input value so the same file can be re-selected next time.
     Without this, browser skips onchange if same filename is chosen again. */
  var inp = document.querySelector('.upload-zone input[type=file]');
  if (inp) inp.value = '';
}

/* ── FUNCTION: UPLOAD.extractRowsFromText(text, ext) ────────
   Converts the raw text of a CSV / TXT / JSON / XML file into
   a flat array of row-strings — one string per row, ready for
   validateRows() to check. Each format is parsed differently:

   .txt  → one URL/email per line, split on newlines.
   .csv  → one row per line; if a row has multiple comma-separated
           cells, they are joined with a space so the whole row
           can be checked (most real files put one URL per row
           in a single column, but this also tolerates extra
           columns without breaking).
   .json → expects an array of strings, e.g. ["a@b.com","c.com"],
           OR an array of objects with a url/email/domain/link
           field, e.g. [{"url":"a@b.com"}].
   .xml  → reads every <url>, <email>, <domain>, or <link> tag's
           text content as one row each. */
function extractRowsFromText(text, ext) {
  if (ext === 'json') {
    var parsed = JSON.parse(text); /* Throws if invalid JSON — caught by caller */
    if (!Array.isArray(parsed)) {
      throw new Error('JSON file must contain an array of URLs/emails.');
    }
    return parsed.map(function(item) {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        /* Try common field names for the link/email value */
        var val = item.url || item.email || item.domain || item.link || item.value || '';
        return String(val).trim();
      }
      return String(item).trim();
    });
  }

  if (ext === 'xml') {
    /* DOMParser is a browser built-in for reading XML text into
       a queryable document object. */
    var xmlDoc = new DOMParser().parseFromString(text, 'application/xml');
    var parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XML file is not valid XML.');
    }
    /* Collect text content from any of these common tag names */
    var tagNames = ['url', 'URL', 'email', 'Email', 'domain', 'Domain', 'link', 'Link'];
    var rows = [];
    tagNames.forEach(function(tag) {
      var nodes = xmlDoc.getElementsByTagName(tag);
      for (var i = 0; i < nodes.length; i++) {
        rows.push(nodes[i].textContent.trim());
      }
    });
    /* Fallback: if no matching tags were found, treat every leaf
       element's text content as a row (handles unknown tag names). */
    if (rows.length === 0) {
      var allEls = xmlDoc.getElementsByTagName('*');
      for (var j = 0; j < allEls.length; j++) {
        if (allEls[j].children.length === 0) { /* leaf node = no nested tags */
          var txt = allEls[j].textContent.trim();
          if (txt) rows.push(txt);
        }
      }
    }
    return rows;
  }

  /* .csv and .txt — split into lines; for CSV, join multi-cell
     rows with a space so the whole row is checked as one string. */
  var lines = text.split(/\r?\n/);
  return lines.map(function(line) {
    if (ext === 'csv') {
      /* Simple comma split — sufficient for single-column URL/email
         lists, which is the expected format for this project. */
      return line.split(',').map(function(cell) { return cell.trim(); }).join(' ').trim();
    }
    return line.trim();
  });
}

/* ── FUNCTION: UPLOAD.looksLikeUrlEmailOrDomain(value) ──────
   Returns true if a single value matches the URL or email
   pattern. Used for two purposes:
     1. Deciding whether row 1 is a header or real data.
     2. Validating every data row.
   Keeping ONE shared check for both means "is this a header"
   and "is this valid data" never disagree with each other. */
function looksLikeUrlEmailOrDomain(value) {
  var trimmed = String(value || '').trim();
  if (!trimmed) return false;

  var urlPattern = new RegExp(
    '^(https?://|ftp://|www\\.)\\S+$' +
    '|^[a-zA-Z0-9][a-zA-Z0-9._-]*\\.[a-zA-Z]{2,}[\\S]*$' +
    '|^linkedin[/][\\S]+$' +
    '|^github[/][\\S]+$' +
    '|^[a-zA-Z0-9._-]+[/][a-zA-Z0-9._/?=&#%-]+$'
  );
  var emailPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

  return urlPattern.test(trimmed) || emailPattern.test(trimmed);
}

/* ── FUNCTION: UPLOAD.validateRows(rows) ─────────────────────
   VALIDATION: Every data row must be a valid URL, domain, email,
   or web link. The header row (if one exists) is detected
   automatically and skipped — see header-detection rule below.

   HEADER DETECTION RULE:
   Look at row 1. If it matches the URL/email pattern, treat it
   as DATA (no header existed — validate it like every other row).
   If it does NOT match (e.g. "URL", "Email", "Links"), treat it
   as a HEADER and skip it — validation starts from row 2.

   REJECTED (no data inside, just plain content):
   - "Kudikudi Akhil" → plain name (no URL structure)
   - "9640972107"     → phone number (no URL structure)
   - "01-01-2000"     → date (no URL structure)
   - "Hello World"    → plain text sentence
   - "@domain.com"    → @ with no name before it

   Returns: { valid:true, urls:[], count:N }
         or { valid:false, reason:'...' } */
function validateRows(rows) {

  /* Filter out completely empty rows */
  rows = rows.filter(function(r) { return r && r.trim().length > 0; });

  if (rows.length === 0) {
    return { valid: false, reason: 'File has no content. Please add URLs.' };
  }

  /* ── HEADER DETECTION ──────────────────────────────────────
     Check row 1 only. If it looks like real data, keep it.
     If it doesn't, treat it as a header and remove it from
     the list before validating the rest. */
  var dataRows = rows;
  var headerSkipped = false;
  if (!looksLikeUrlEmailOrDomain(rows[0])) {
    dataRows = rows.slice(1); /* Drop row 1 — it was a header */
    headerSkipped = true;
  }

  if (dataRows.length === 0) {
    return { valid: false, reason: 'File only contains a header row — no actual URLs/emails found underneath it.' };
  }

  /* Plain-text / date / phone rejection patterns — checked first
     so we give a clearer error than "not a valid URL" for these.
     IMPORTANT: plainTextPattern requires at least one SPACE,
     because real sentences ("Hello World") always have spaces
     but real domains ("example.org") never do — without this,
     short domain names get wrongly rejected as "plain text". */
  var datePattern      = /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/;
  var phonePattern     = /^\d{7,15}$/;
  var plainTextPattern = /^[a-zA-Z][a-zA-Z ,.!?'"()-]*\s[a-zA-Z ,.!?'"()-]{4,}$/;

  var validURLs    = [];
  var invalidLines = [];

  dataRows.forEach(function(row, index) {
    var trimmed = row.trim();
    var rowNum = index + 1 + (headerSkipped ? 1 : 0); /* real row number for error messages */

    var isDate  = datePattern.test(trimmed);
    var isPhone = phonePattern.test(trimmed);
    var isPlain = plainTextPattern.test(trimmed);

    if (isDate || isPhone || isPlain) {
      invalidLines.push('Row ' + rowNum + ': "' + trimmed.slice(0, 40) + '"');
      return;
    }

    if (looksLikeUrlEmailOrDomain(trimmed)) {
      validURLs.push(trimmed);
    } else {
      invalidLines.push('Row ' + rowNum + ': "' + trimmed.slice(0, 40) + '"');
    }
  });

  if (invalidLines.length > 0) {
    var sample = invalidLines.slice(0, 2).join(', ');
    return {
      valid  : false,
      reason : 'Non-URL content found (' + sample + '). '
             + 'Every row must be a URL like https://example.com, '
             + 'a domain like example.com, or an email like name@domain.com. '
             + 'Remove plain names, numbers, or text and try again.'
    };
  }

  if (validURLs.length === 0) {
    return { valid: false, reason: 'No valid URLs found. File must contain web URLs, domains, or emails.' };
  }

  return { valid: true, urls: validURLs, count: validURLs.length };
}

/* ── FUNCTION: UPLOAD.renderFileList() ──────────────────────
   Re-draws the list of all uploaded files in the UI.
   Called every time a file is added or removed.
   Shows each file's name, URL count, and a Remove button. */
function renderFileList() {
  var listEl = document.getElementById('fileList'); /* File list container */
  if (!listEl) return;

  /* If no files uploaded yet, show empty placeholder */
  if (allFiles.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text3);text-align:center;padding:16px;font-size:12px">No files added yet</div>';
    hideProceed(); /* Hide the proceed button when no files */
    /* Page height may have shrunk back down (file list card hidden) —
       resync the background video to match the new, possibly shorter,
       full page height. setTimeout lets the DOM finish updating first. */
    setTimeout(syncVideoBgHeight, 0);
    return;
  }

  /* Build HTML for each file row */
  var html = '';
  allFiles.forEach(function(f, index) {
    /* Create a row for each file with a Remove button */
    html += '<div class="file-row" id="filerow-' + index + '">'
      + '<div class="file-row-info">'
      + '<span class="file-row-icon">📄</span>'
      + '<div>'
      + '<div class="file-row-name">' + f.name + '</div>'
      + '<div class="file-row-meta">'
      + f.count + ' URLs · '
      + (f.size / 1024).toFixed(1) + ' KB · .'
      + f.ext.toUpperCase()
      + '</div>'
      + '</div>'
      + '</div>'
      /* onclick calls removeFile(index) to remove this file */
      + '<button class="file-row-remove" onclick="removeFile(' + index + ')">✕ Remove</button>'
      + '</div>';
  });

  /* Show total URL count at the bottom of the file list */
  html += '<div class="file-list-total">'
    + 'Total URLs across all files: '
    + '<strong style="color:var(--green)">' + allURLs.length + '</strong>'
    + '</div>';

  /* .innerHTML replaces the entire contents of the list element */
  listEl.innerHTML = html;

  /* Make the file list container visible */
  var container = document.getElementById('fileListContainer');
  if (container) container.style.display = 'block';

  /* Page just grew taller (file list card is now showing) —
     resync the background video so it still covers the full
     page with no black gap at the bottom. setTimeout lets the
     newly-inserted HTML actually affect the page's layout
     height before we measure it. */
  setTimeout(syncVideoBgHeight, 0);
}

/* ── FUNCTION: UPLOAD.removeFile(index) ─────────────────────
   Removes one file from the allFiles array by its index.
   Rebuilds allURLs from scratch after removal.
   Called when user clicks the ✕ Remove button on a file row. */
function removeFile(index) {

  /* Remove the file at the given index from the array.
     .splice(index, 1) removes 1 element starting at 'index'. */
  allFiles.splice(index, 1);

  /* Rebuild allURLs from all remaining files.
     We start with empty array and re-add all URLs. */
  allURLs = [];
  allFiles.forEach(function(f) {
    f.urls.forEach(function(url) {
      if (!allURLs.includes(url)) {
        allURLs.push(url); /* Add URL only if not already in list */
      }
    });
  });

  /* Re-render the file list with the removed file gone */
  renderFileList();

  /* Clear messages from previous operations */
  clearMessages();

  /* If no files left, hide the Proceed button */
  if (allFiles.length === 0) {
    hideProceed(); /* Hide button when no files remain */
  } else {
    showUploadSuc(
      '✓ File removed. '
      + allURLs.length + ' URLs remaining across '
      + allFiles.length + ' file(s).'
    );
  }
}

/* ── FUNCTION: UPLOAD.proceedToDashboard() ──────────────────
   Called when "Start Fuzzing Engine" button is clicked.
   Saves all combined file data to sessionStorage.
   The dashboard.html will read this data on load. */
function proceedToDashboard() {

  /* Make sure we have at least one valid file uploaded */
  if (allFiles.length === 0 || allURLs.length === 0) {
    showUploadErr('Please upload at least one valid URL file first.');
    return;
  }

  /* Save all filenames joined by comma for display in dashboard topbar */
  var fileNames = allFiles.map(function(f) { return f.name; }).join(', ');
  sessionStorage.setItem('ossFuzzFile', fileNames);

  /* Save ALL URLs as a newline-joined string.
     Dashboard.js will split them back with .split('\n'). */
  sessionStorage.setItem('ossFuzzURLs', allURLs.join('\n'));

  /* Save total URL count as a string for quick display */
  sessionStorage.setItem('ossFuzzURLCount', String(allURLs.length));

  /* Save file count so dashboard knows how many files were loaded */
  sessionStorage.setItem('ossFuzzFileCount', String(allFiles.length));

  /* Navigate to the dashboard page */
  window.location.href = 'dashboard.html';
}

/* ── UI HELPER FUNCTIONS ────────────────────────────────────*/

/* Show red error message box */
function showUploadErr(msg) {
  var el = document.getElementById('errMsg');
  if (el) { el.innerHTML = '⚠ ' + msg; el.style.display = 'block'; }
  var s = document.getElementById('sucMsg'); /* Also hide success box */
  if (s) s.style.display = 'none';
}

/* Show green success message box */
function showUploadSuc(msg) {
  var el = document.getElementById('sucMsg');
  if (el) { el.innerHTML = msg; el.style.display = 'block'; }
  var e = document.getElementById('errMsg'); /* Also hide error box */
  if (e) e.style.display = 'none';
}

/* Hide both message boxes — call before processing a new file */
function clearMessages() {
  var e = document.getElementById('errMsg');
  var s = document.getElementById('sucMsg');
  if (e) e.style.display = 'none';
  if (s) s.style.display = 'none';
}

/* Show the "Start Fuzzing Engine" proceed button */
function showProceed() {
  var b = document.getElementById('proceedBtn');
  if (b) b.style.display = 'block'; /* Make button visible */
}

/* Hide the proceed button (when no files are loaded) */
function hideProceed() {
  var b = document.getElementById('proceedBtn');
  if (b) b.style.display = 'none'; /* Hide the button */
}
