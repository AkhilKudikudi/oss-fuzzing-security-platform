"""
FILE    : app.py
PURPOSE : Python (Flask) web server — does the exact same job as server.js.
          Serves all project files AND provides the /api/login and
          /api/register endpoints, backed by the SAME SQLite database
          file (data/users.db) that the Node.js server uses.

WHY THIS FILE EXISTS:
  This project has TWO interchangeable backend servers:
    1. server.js  → Node.js + Express version
    2. app.py     → Python + Flask version  (this file)
  Both read and write the SAME database file, so an account
  created while running one server can log in while running
  the other. They are never run at the same time — you pick
  ONE command depending on which language you want to demo.

  HOW TO EXPLAIN TO HOD:
  "Sir, the frontend — HTML, CSS, JavaScript, the dashboard,
  the charts, the fuzzing engine — never changes. Only the
  backend server changes. I can start the project using Python
  with 'python app.py', or using Node.js with 'node server.js'.
  Both implement the same two API routes — /api/register and
  /api/login — against the same SQLite database, so the project
  behaves identically either way."

  HOW TO RUN IN VS CODE:
  Step 1 : Open this project folder in VS Code.
  Step 2 : Open Terminal → Terminal → New Terminal.
  Step 3 : Install dependencies (only needed ONCE):
              pip install -r requirements.txt
  Step 4 : Start the server:
              python app.py
  Step 5 : Terminal prints the URL → copy → paste in browser.
  Step 6 : To STOP the server → press Ctrl + C in terminal.
"""

import os
import re
import sqlite3
from datetime import datetime, timezone

import bcrypt
from flask import Flask, jsonify, request, send_from_directory, abort

# ── PATHS ──────────────────────────────────────────────────────
# ROOT_DIR = the folder this file lives in (the whole project folder).
# DATA_DIR / DB_PATH point at the SAME database file server.js uses,
# so accounts are shared between the Python and Node versions.
#
# RENDER_DISK_PATH: when this project is deployed on Render.com with
# a persistent disk attached, Render sets this environment variable
# to the disk's mount path (e.g. /var/data) so the database survives
# server restarts/sleeps. Locally on your laptop, this variable does
# not exist, so DATA_DIR falls back to the normal local "data" folder
# exactly as before — nothing changes for VS Code / local use.
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
RENDER_DISK_PATH = os.environ.get('RENDER_DISK_PATH')
DATA_DIR = RENDER_DISK_PATH if RENDER_DISK_PATH else os.path.join(ROOT_DIR, 'data')
DB_PATH  = os.path.join(DATA_DIR, 'users.db')

# PORT: Render assigns its own port dynamically via the PORT
# environment variable. Locally, this variable doesn't exist,
# so it falls back to 4000 exactly as before.
PORT = int(os.environ.get('PORT', 4000))

app = Flask(__name__, static_folder=None)  # static_folder=None: we serve files manually below


# ── DATABASE SETUP ────────────────────────────────────────────
def get_db():
    """Open a connection to the shared SQLite database.
    A new connection is opened per request — this is the normal,
    safe pattern for small Flask apps using sqlite3."""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us access columns by name, e.g. row['email']
    return conn


def init_db():
    """Create the users table if it does not already exist.
    Uses the exact same column names and types as server.js so
    the two servers are 100% compatible with the same file."""
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            fullName TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT NOT NULL,
            password TEXT NOT NULL,
            createdAt TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()


# ── VALIDATION HELPERS (same rules as server.js) ────────────────
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def normalize_email(email):
    return (email or '').strip().lower()


# ── CORS HEADERS (so fetch() calls work the same as Express) ────
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


# ── API: REGISTER ────────────────────────────────────────────
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return ('', 200)

    data = request.get_json(silent=True) or {}
    first_name = str(data.get('firstName', '')).strip()
    last_name  = str(data.get('lastName', '')).strip()
    full_name  = str(data.get('fullName', '')).strip() or ' '.join(
        p for p in [first_name, last_name] if p
    )
    email    = normalize_email(data.get('email', ''))
    phone    = str(data.get('phone', '')).strip()
    password = str(data.get('password', ''))

    if not email or not password:
        return jsonify({'error': 'Please provide an email and password.'}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            'SELECT id FROM users WHERE LOWER(email) = ?', (email,)
        ).fetchone()

        if existing:
            return jsonify({'error': 'This email is already registered. Please log in.'}), 400

        # bcrypt.hashpw requires bytes; gensalt(10) matches bcryptjs's default cost factor.
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')
        created_at = datetime.now(timezone.utc).isoformat()

        conn.execute(
            '''INSERT INTO users (firstName, lastName, fullName, email, phone, password, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (first_name, last_name, full_name, email, phone, hashed, created_at)
        )
        conn.commit()
        return jsonify({'message': 'Account created successfully.'}), 201

    except sqlite3.Error as e:
        return jsonify({'error': 'Server error while creating account.'}), 500
    finally:
        conn.close()


# ── API: LOGIN ────────────────────────────────────────────────
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return ('', 200)

    data = request.get_json(silent=True) or {}
    email    = normalize_email(data.get('email', ''))
    password = str(data.get('password', ''))

    if not email or not password:
        return jsonify({'error': 'Please enter both email and password.'}), 400

    conn = get_db()
    try:
        row = conn.execute(
            '''SELECT id, firstName, lastName, fullName, email, phone, password, createdAt
               FROM users WHERE LOWER(email) = ?''',
            (email,)
        ).fetchone()

        if row is None:
            return jsonify({'error': 'Invalid email or password. Please try again.'}), 401

        # bcrypt.checkpw compares the plain password against the stored hash.
        # This works correctly even though the hash may have been created by
        # Node's bcryptjs — both libraries use the same $2a$/$2b$ hash format.
        password_ok = bcrypt.checkpw(password.encode('utf-8'), row['password'].encode('utf-8'))

        if not password_ok:
            return jsonify({'error': 'Invalid email or password. Please try again.'}), 401

        return jsonify({
            'user': {
                'firstName': row['firstName'],
                'lastName': row['lastName'],
                'fullName': row['fullName'],
                'email': row['email'],
                'phone': row['phone'],
                'createdAt': row['createdAt']
            }
        })

    except sqlite3.Error:
        return jsonify({'error': 'Server error while logging in.'}), 500
    finally:
        conn.close()


# ── STATIC FILE SERVING ─────────────────────────────────────────
# Serves index.html, dashboard.html, css/, js/, images/, etc.
# Mirrors express.static() + the root route in server.js.
@app.route('/')
def serve_index():
    return send_from_directory(ROOT_DIR, 'index.html')


@app.route('/<path:filepath>')
def serve_file(filepath):
    full_path = os.path.join(ROOT_DIR, filepath)
    if os.path.isfile(full_path):
        directory, filename = os.path.split(full_path)
        return send_from_directory(directory, filename)
    abort(404)


# ── START SERVER ────────────────────────────────────────────────
# init_db() must run even when started by gunicorn (Render's
# production server), not just when run directly with "python app.py".
# Calling it here, at import time, covers both cases.
init_db()

if __name__ == '__main__':
    print('\n╔══════════════════════════════════════════════╗')
    print('║         OSS FUZZING SECURITY PLATFORM        ║')
    print('║              (Python / Flask backend)         ║')
    print('╠══════════════════════════════════════════════╣')
    print('║  ✅ Server is RUNNING!                        ║')
    print('║                                              ║')
    print('║  👉 Copy this URL and paste in browser:      ║')
    print('║                                              ║')
    print(f'║     http://localhost:{PORT}                    ║')
    print('║                                              ║')
    print('╠══════════════════════════════════════════════╣')
    print('║  Student  : Kudikudi Akhil                   ║')
    print('║  H.T.No   : 104324862027                     ║')
    print('║  Course   : 2nd MCA — IV Semester            ║')
    print('║  College  : UPG College, Siddipet            ║')
    print('║  Guide    : U. Rajender                      ║')
    print('╠══════════════════════════════════════════════╣')
    print('║  To STOP server → press  Ctrl + C            ║')
    print('╚══════════════════════════════════════════════╝\n')
    app.run(host='0.0.0.0', port=PORT, debug=False)
