/*
  FILE    : server.js
  PURPOSE : Express (Node.js) web server — serves all project files
            and provides the login/register API on localhost.

  This project has TWO interchangeable backend servers:
    1. server.js  → Node.js + Express version  (this file)
    2. app.py     → Python + Flask version
  Both read and write the SAME database file (data/users.db),
  so an account created on one server can log in on the other.
  Run only ONE of them at a time — pick the command for whichever
  language you want to demonstrate.

  ══════════════════════════════════════════════════════
  HOW TO RUN IN VS CODE (Step-by-step for presentation):
  ══════════════════════════════════════════════════════
  Step 1 : Open this project folder in VS Code
           File → Open Folder → select "oss-fuzzing-security-platform"

  Step 2 : Open VS Code Terminal
           Menu → Terminal → New Terminal
           (A black panel appears at the bottom)

  Step 3 : Install dependencies (only needed ONCE)
           Type this command and press Enter:
              npm install

  Step 4 : Start the server
           Type this command and press Enter:
              npm start
                 OR
              node server.js

  Step 5 : Terminal will print:
              ✅ Server is RUNNING!
              👉 http://localhost:4000

  Step 6 : Copy that URL → Open any browser → Paste → Enter
           Your project runs as a live website!

  Step 7 : To STOP the server → press Ctrl + C in terminal
  ══════════════════════════════════════════════════════
*/

const express = require('express'); /* Load Express web server framework */
const path    = require('path');    /* Load path helper for file locations */
const fs      = require('fs');      /* Load file system helper */
const bcrypt  = require('bcryptjs');/* Load bcrypt for password hashing */
const sqlite3 = require('sqlite3').verbose();
const app     = express();          /* Create the Express application */
const PORT    = 4000;               /* Server listens on port 4000 */

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'users.db');

/* Ensure the data directory exists so SQLite can create the database file. */
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* Open or create the SQLite database file. */
const db = new sqlite3.Database(DB_PATH, function(err) {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

/* Create the users table if it does not already exist. */
db.serialize(function() {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`
  );
});

/* Parse JSON and URL-encoded request bodies for API routes. */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* Allow browser preflight requests and simple CORS for local development. */
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

/* Explicitly reject unsupported methods for auth endpoints so clients
   receive a clear 405 instead of a confusing 404 or default HTML error. */
app.all(['/api/login', '/api/register'], function(req, res, next) {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST for this endpoint.' });
  }
  next();
});

/* ── SERVE STATIC FILES ──────────────────────────────────────
   express.static() automatically serves HTML, CSS, JS, images. */
app.use(express.static(path.join(__dirname)));

/* ── ROOT ROUTE ──────────────────────────────────────────────
   When someone opens http://localhost:4000 (with no path),
   send them the login page automatically. */
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* Validate email and phone before writing to the database. */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(phone);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

app.post('/api/register', function(req, res) {
  const firstName = String(req.body.firstName || '').trim();
  const lastName  = String(req.body.lastName || '').trim();
  const fullName  = String(req.body.fullName || '').trim() || [firstName, lastName].filter(Boolean).join(' ');
  const email     = normalizeEmail(req.body.email);
  const phone     = String(req.body.phone || '').trim();
  const password  = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide an email and password.' });
  }

  db.get('SELECT id FROM users WHERE LOWER(email) = ?', [email], function(err, row) {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Server error while checking account.' });
    }

    if (row) {
      return res.status(400).json({ error: 'This email is already registered. Please log in.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const createdAt = new Date().toISOString();

    db.run(
      'INSERT INTO users (firstName, lastName, fullName, email, phone, password, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [firstName, lastName, fullName, email, phone, hash, createdAt],
      function(insertErr) {
        if (insertErr) {
          console.error('Insert error:', insertErr.message);
          return res.status(500).json({ error: 'Server error while creating account.' });
        }

        return res.status(201).json({ message: 'Account created successfully.' });
      }
    );
  });
});

app.post('/api/login', function(req, res) {
  const email    = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter both email and password.' });
  }

  db.get(
    'SELECT id, firstName, lastName, fullName, email, phone, password, createdAt FROM users WHERE LOWER(email) = ?',
    [email],
    function(err, row) {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Server error while logging in.' });
      }

      if (!row || !bcrypt.compareSync(password, row.password)) {
        return res.status(401).json({ error: 'Invalid email or password. Please try again.' });
      }

      return res.json({
        user: {
          firstName: row.firstName,
          lastName: row.lastName,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          createdAt: row.createdAt
        }
      });
    }
  );
});

/* Handle invalid JSON payloads with clear JSON error responses. */
app.use(function(err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    console.error('Invalid JSON payload:', err.message);
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  next(err);
});

/* ── START SERVER ────────────────────────────────────────────
   app.listen() starts the server on the given PORT.
   The callback function runs once the server is ready. */
app.listen(PORT, function() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║         OSS FUZZING SECURITY PLATFORM        ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  ✅ Server is RUNNING!                        ║');
  console.log('║                                              ║');
  console.log('║  👉 Copy this URL and paste in browser:      ║');
  console.log('║                                              ║');
  console.log('║     http://localhost:' + PORT + '                  ║');
  console.log('║                                              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Student  : Kudikudi Akhil                   ║');
  console.log('║  H.T.No   : 104324862027                     ║');
  console.log('║  Course   : 2nd MCA — IV Semester            ║');
  console.log('║  College  : UPG College, Siddipet            ║');
  console.log('║  Guide    : U. Rajender                      ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  To STOP server → press  Ctrl + C            ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});
