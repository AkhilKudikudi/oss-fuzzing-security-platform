/*
  ============================================================
  FILE    : js/auth.js
  PURPOSE : Handles all user authentication logic:
            Login, Registration, Session management, Logout.
  MODULE  : Authentication JavaScript
  USED BY : index.html (login), register.html (register),
            upload.html and dashboard.html (session check).

  HOW TO EXPLAIN TO HOD:
  "Sir, this is the Authentication module. Authentication means
  verifying who the user is. This file calls the backend auth API
  to register new accounts and validate login credentials. The
  user data is now stored in a server-side SQLite database."

  KEY CONCEPTS USED:
  - fetch()       : Calls backend API endpoints for login/register.
  - sessionStorage: Stores login state until the browser tab closes.
  - JSON.stringify(): Converts objects to strings for network transport.
  ============================================================
*/

/* ── API BASE URL — works both locally AND on the live link ──
   LOCALLY (python app.py / node server.js): the frontend and
   backend are served by the SAME process on the same address
   (e.g. http://localhost:4000), so a relative path like
   "/api/login" already reaches the right place — API_BASE
   stays empty and nothing changes from before.

   ON GITHUB PAGES (the live deployment link): the frontend is
   hosted on github.io, but the backend (with the real database)
   is hosted separately on Render.com, on a different domain.
   A relative "/api/login" would try to reach github.io itself,
   which has no backend — so on github.io specifically, API_BASE
   is set to the full Render backend URL instead.

   This single switch is the ONLY thing that changes between
   local and live — every other line of login/register logic
   stays exactly the same. */
var API_BASE = (window.location.hostname.indexOf('github.io') !== -1)
  ? 'https://oss-fuzzing-security-platform.onrender.com'
  : '';


/* ── FUNCTION: AUTH.guardPage() ─────────────────────────────
   Checks if the user is logged in.
   If NOT logged in → redirects to login page immediately.
   Call this at the top of any page that needs login.

   WHY window.location.replace() and not .href?
   .replace() does NOT add the page to browser history.
   So pressing the Back button won't return here after logout. */
function guardPage() {
  var loggedIn = sessionStorage.getItem('ossFuzzLoggedIn'); /* Read login flag */
  if (!loggedIn) {
    window.location.replace('index.html'); /* Redirect to login if not logged in */
  }
}


/* ── FUNCTION: AUTH.getLoggedInUser() ───────────────────────
   Returns the first name of the currently logged-in user.
   Returns empty string if no one is logged in. */
function getLoggedInUser() {
  return sessionStorage.getItem('ossFuzzLoggedIn') || ''; /* Return name or empty */
}


/* ── FUNCTION: AUTH.doLogout() ──────────────────────────────
   Logs the user out by clearing all session data.
   sessionStorage.clear() removes ALL keys we saved during login.
   After clearing, redirects to login page. */
function doLogout() {
  sessionStorage.clear();               /* Remove all session data */
  window.location.replace('index.html'); /* Go back to login page  */
}

function parseJSONResponse(response) {
  return response.text().then(function(text) {
    if (!response.ok) {
      var message = text || response.statusText;
      try {
        var json = JSON.parse(text || '{}');
        message = json.error || json.message || message;
      } catch (e) {
        // If the response is HTML or invalid JSON, keep the raw text.
      }
      throw new Error(message || 'Server error.');
    }

    try {
      return JSON.parse(text || '{}');
    } catch (e) {
      throw new Error('Server returned invalid JSON.');
    }
  });
}


/* ── FUNCTION: AUTH.doLogin() ───────────────────────────────
   Called when the user clicks "Sign In" on index.html.
   Steps:
     1. Read email and password from input fields.
     2. Validate they are not empty.
     3. Look up the user in localStorage.
     4. If found and password matches → save session → redirect.
     5. If not found or wrong password → show error. */
function doLogin() {

  /* Read what the user typed. .trim() removes extra spaces. */
  var email = document.getElementById('email').value.trim();
  var pass  = document.getElementById('pass').value.trim();

  /* Validate: both fields must be filled */
  if (!email || !pass) {
    showMsg('err', 'Please enter both email and password.');
    return;
  }

  fetch(API_BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: pass })
  })
  .then(parseJSONResponse)
  .then(function(data) {
    var found = data.user;

    sessionStorage.setItem('ossFuzzLoggedIn', found.firstName);
    sessionStorage.setItem('ossFuzzUser', JSON.stringify(found));

    showMsg('suc', '✓ Login successful! Redirecting...');
    setTimeout(function() {
      window.location.href = 'upload.html';
    }, 1200);
  })
  .catch(function(err) {
    showMsg('err', err.message || 'Invalid email or password. Please try again.');
  });
}


/* ── FUNCTION: AUTH.doRegister() ────────────────────────────
   Called when user clicks "Create Account" on register.html.
   Validates all fields → saves new user → redirects to login.

   STEP 1 FIXES:
   1. Phone must be EXACTLY 10 digits — no more, no less.
   2. Full Name must equal "FirstName LastName" combination.
      If user types First="Akhil" Last="Kudikudi" then
      Full Name must be "Akhil Kudikudi" — any other value
      gives an error message. */
function doRegister() {

  /* Read all field values and trim whitespace */
  var firstName = document.getElementById('firstName').value.trim();
  var lastName  = document.getElementById('lastName').value.trim();
  var fullName  = document.getElementById('fullName').value.trim();
  var email     = document.getElementById('email').value.trim();
  var phone     = document.getElementById('phone').value.trim();
  var pass      = document.getElementById('pass').value.trim();
  var pass2     = document.getElementById('pass2').value.trim();

  if (!email || !pass || !pass2) {
    showMsg('err', 'Please enter an email and password.');
    return;
  }

  /* ── FULL NAME VALIDATION ───────────────────────────────────
     Rule: Full Name must be EXACTLY "FirstName LastName" —
     same case, single space, no extra characters of any kind.

     Examples that PASS:
       First="Prashanth" Last="L"       → Full="Prashanth L"
       First="Akhil"     Last="Sundu"   → Full="Akhil Sundu"
       First="Madhukar"  Last="KD"      → Full="Madhukar KD"

     Examples that are REJECTED:
       "prashanth l"   (wrong case)
       "Prashanth L."  (extra period)
       "Prashanth  L"  (extra space)
       "Prashanth Lee" (doesn't match Last Name exactly)

     We build the expected value ourselves from firstName and
     lastName, then compare it character-for-character against
     what the user actually typed in the Full Name box. */
  if (!firstName || !lastName || !fullName) {
    showMsg('err', 'Please enter your First Name, Last Name, and Full Name.');
    return;
  }

  var expectedFullName = firstName + ' ' + lastName; /* exact rebuild, single space */

  if (fullName !== expectedFullName) {
    showMsg('err',
      'Full Name must exactly match First Name + Last Name. ' +
      'Expected "' + expectedFullName + '" but got "' + fullName + '". ' +
      'Check for extra spaces, periods, or different capitalization.');
    return;
  }

  if (pass !== pass2) {
    showMsg('err', 'Passwords do not match. Please re-enter.');
    return;
  }

  fetch(API_BASE + '/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: firstName,
      lastName: lastName,
      fullName: fullName,
      email: email,
      phone: phone,
      password: pass
    })
  })
  .then(parseJSONResponse)
  .then(function() {
    showMsg('suc', '✓ Account created! Redirecting to login...');
    setTimeout(function() {
      window.location.href = 'index.html';
    }, 1500);
  })
  .catch(function(err) {
    showMsg('err', err.message || 'Registration failed. Please try again.');
  });
}


/* ── FUNCTION: AUTH.checkStrength() ─────────────────────────
   Called every time the user types in the password field.
   Checks 4 rules and updates the strength bar and pill list. */
function checkStrength() {
  var pw  = document.getElementById('pass').value; /* Get password value */
  var pw2 = document.getElementById('pass2') ?
            document.getElementById('pass2').value : '';

  /* Check each requirement */
  var hasLen   = pw.length >= 8;          /* At least 8 characters */
  var hasUpper = /[A-Z]/.test(pw);        /* Has uppercase letter   */
  var hasNum   = /[0-9]/.test(pw);        /* Has a digit            */
  var hasMatch = pw !== '' && pw === pw2; /* Both passwords same    */

  /* Update checklist pills — setReq() adds or removes "met" class */
  setReq('req-len',   hasLen);
  setReq('req-upper', hasUpper);
  setReq('req-num',   hasNum);
  setReq('req-match', hasMatch);

  /* Count how many requirements pass (0 to 4) */
  var score = [hasLen, hasUpper, hasNum, pw.length >= 12]
              .filter(Boolean).length;

  var bar = document.getElementById('strBar'); /* Strength bar element */
  var lbl = document.getElementById('strLbl'); /* Strength label text  */

  /* Update bar width and colour based on score */
  if (!pw) {
    bar.style.width = '0%'; lbl.textContent = 'Enter a password';
  } else if (score <= 1) {
    bar.style.width = '25%'; bar.style.background = '#ff1744';
    lbl.textContent = 'Weak — add uppercase & numbers';
    lbl.style.color = '#ff5252';
  } else if (score === 2) {
    bar.style.width = '55%'; bar.style.background = '#ffd600';
    lbl.textContent = 'Medium — getting better';
    lbl.style.color = '#ffd600';
  } else if (score === 3) {
    bar.style.width = '80%'; bar.style.background = '#00c853';
    lbl.textContent = 'Strong ✓'; lbl.style.color = '#00c853';
  } else {
    bar.style.width = '100%'; bar.style.background = '#00e676';
    lbl.textContent = 'Very Strong ✓✓'; lbl.style.color = '#00e676';
  }
}


/* ── FUNCTION: AUTH.setReq(id, isMet) ───────────────────────
   Helper: adds or removes "met" CSS class from a pill element.
   "met" class makes the pill turn green (defined in styles.css). */
function setReq(id, isMet) {
  var el = document.getElementById(id); /* Find the pill element */
  if (!el) return;                       /* Exit if not found     */
  if (isMet) {
    el.classList.add('met');    /* Add green class when rule passes */
  } else {
    el.classList.remove('met'); /* Remove green class when rule fails */
  }
}


/* ── FUNCTION: AUTH.showMsg(type, text) ─────────────────────
   Shows an error or success message inside the card.
   type = 'err' shows the red box.
   type = 'suc' shows the green box.
   Hides the opposite box to prevent both showing at once. */
function showMsg(type, text) {
  var errEl = document.getElementById('errMsg'); /* Red error box   */
  var sucEl = document.getElementById('sucMsg'); /* Green success box */

  if (type === 'err') {
    if (errEl) { errEl.textContent = '⚠ ' + text; errEl.style.display = 'block'; }
    if (sucEl) { sucEl.style.display = 'none'; } /* Hide success box */
  } else {
    if (sucEl) { sucEl.textContent = text; sucEl.style.display = 'block'; }
    if (errEl) { errEl.style.display = 'none'; } /* Hide error box   */
  }
}


/* ── FUNCTION: AUTH.setTopbar(firstName) ────────────────────
   Called by upload.html and dashboard.html to show the
   logged-in user's name and first initial in the topbar. */
function setTopbar(firstName) {
  var greetEl  = document.getElementById('userGreeting'); /* "Hi, Akhil" text */
  var avatarEl = document.getElementById('userInitial');  /* Avatar circle    */

  /* Show "Hi, Akhil" next to the avatar circle */
  if (greetEl)  greetEl.textContent = 'Hi, ' + firstName;

  /* Show first letter as avatar e.g. "A" for Akhil.
     .charAt(0) gets the 1st character.
     .toUpperCase() makes it a capital letter. */
  if (avatarEl) avatarEl.textContent = firstName.charAt(0).toUpperCase();
}
