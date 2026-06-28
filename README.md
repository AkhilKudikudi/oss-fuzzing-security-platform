# OSS Fuzzing Security Detection Platform

> **Final Year Major Project — MCA IV Semester**
> Kudikudi Akhil | H.T.No: 104324862027
> UPG College (Osmania University), Siddipet
> Guide: U. Rajender | HOD: V. Chandra Shekhar

---

## 🔗 Live Deployment Link

**GitHub Pages:** https://YOUR-GITHUB-USERNAME.github.io/oss-fuzzing-security-platform

> ⚠️ Replace `YOUR-GITHUB-USERNAME` with your actual GitHub username after deployment.
> See **Step 5: GitHub Pages Deployment** below.

---

## 📌 Project Overview

The **OSS Fuzzing Security Detection Platform** is a browser-based security testing simulation dashboard that demonstrates how fuzzing engines detect vulnerabilities in open-source software (OSS). It simulates the full fuzzing pipeline — from target loading to bug detection, classification, and reporting.

### Key Features
- **Live Fuzzing Engine** — Start, Pause, Resume, Stop, Reset with real-time state management
- **Bug Detection & Classification** — Buffer Overflow, Memory Leak, Null Pointer, Integer Overflow
- **Live Charts** — Throughput Over Time, Resolution Rate, Pie Charts, Bar Graphs
- **Live Workflow Animation** — 6-step fuzzing pipeline with node-by-node progression
- **Export Report** — Downloadable security report after session completes
- **Multi-file Upload** — Upload multiple URL target files
- **Stable/Complete Mode** — Auto-resolves all active bugs before marking session stable

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Charts | Chart.js 4.4.1 |
| Backend (choice of two) | Node.js + Express **or** Python + Flask — both implement the same `/api/login` and `/api/register` routes against the same SQLite database (`data/users.db`) |
| Deployment | GitHub Pages (static) / localhost (demo) |
| Font | JetBrains Mono, Space Grotesk (Google Fonts) |

This project intentionally has **two interchangeable backend servers**. The frontend (every HTML/CSS/JS file, the dashboard, the charts, the fuzzing engine) never changes — only the small server that handles login/register and serves the files changes. Run **one or the other**, never both at the same time, since they'd both try to use port 4000.

---

## 🚀 How to Run Locally (VS Code — For Presentation)

### Prerequisites
- [Node.js](https://nodejs.org) installed (v14 or higher) — for the Node.js version
- [Python](https://www.python.org/downloads/) installed (v3.9 or higher) — for the Python version
- [VS Code](https://code.visualstudio.com) installed

### Step-by-Step

**Step 1 — Open project in VS Code**
```
File → Open Folder → select "oss-fuzzing-security-platform" folder → OK
```

**Step 2 — Open Terminal in VS Code**
```
Menu → Terminal → New Terminal
```
A terminal panel opens at the bottom of VS Code.

**Step 3 — Install dependencies (only needed ONCE per language)**

If you want to run the **Node.js** version:
```bash
npm install
```

If you want to run the **Python** version:
```bash
pip install -r requirements.txt
```

**Step 4 — Start the server (pick ONE)**

Node.js version:
```bash
node server.js
```
Or:
```bash
npm start
```

Python version:
```bash
python app.py
```

**Step 5 — See the URL in terminal**

Both versions print the same URL, since both use port 4000:
```
╔══════════════════════════════════════════════╗
║  ✅ Server is RUNNING!                        ║
║  👉 http://localhost:4000                     ║
╚══════════════════════════════════════════════╝
```

**Step 6 — Open in browser**
Copy `http://localhost:4000` → open any browser → paste → press Enter.

**Step 7 — To stop the server**
Press `Ctrl + C` in the VS Code terminal. You must stop one server before starting the other, since they share the same port.

**Note on accounts:** Both servers read and write the exact same database file (`data/users.db`). An account you register while running `node server.js` will work perfectly when you log in after switching to `python app.py`, and vice versa — there is one shared set of accounts, not two separate ones.

---

## 📂 Project Structure

```
oss-fuzzing-security-platform/
│
├── index.html          ← Step 1: Login page
├── register.html       ← Step 1: Register page
├── upload.html         ← Step 2: File upload page
├── dashboard.html      ← Step 3: Main dashboard
├── server.js           ← Node.js Express server (backend option 1)
├── app.py              ← Python Flask server (backend option 2)
├── package.json        ← Node.js dependencies
├── requirements.txt    ← Python dependencies
├── sample_urls.txt     ← Sample URL file for demo
├── run_server.bat      ← Windows quick-start (Python)
├── run_node_server.bat ← Windows quick-start (Node.js)
├── README.md           ← This file
│
├── data/
│   └── users.db        ← Shared SQLite database (both servers use this)
│
├── css/
│   └── styles.css      ← All CSS styles
│
└── js/
    ├── auth.js         ← Login / register — calls /api/login & /api/register
    ├── upload.js       ← File upload & URL validation
    ├── fuzzer.js       ← Engine core (Start/Pause/Stop/Reset)
    ├── fuzzer2.js      ← Settings, stats, pipeline animation
    └── fuzzer3.js      ← Completion, export, bug type charts
```

---

## 🌐 GitHub Pages Deployment (For HOD Review)

Follow these steps **after creating your GitHub account**.

### Step 1 — Create GitHub Account
Go to https://github.com → Sign Up → use your email → verify.

### Step 2 — Create New Repository
1. Click the **+** button (top right) → **New repository**
2. Repository name: `oss-fuzzing-security-platform`
3. Set to **Public**
4. Do NOT check "Add README" (we already have one)
5. Click **Create repository**

### Step 3 — Install Git (if not installed)
Download from https://git-scm.com → install with default settings.

### Step 4 — Push code to GitHub
Open VS Code terminal in the project folder and run these commands one by one:

```bash
git init
git add .
git commit -m "Initial commit - OSS Fuzzing Security Platform"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/oss-fuzzing-security-platform.git
git push -u origin main
```
> Replace `YOUR-GITHUB-USERNAME` with your actual GitHub username.

### Step 5 — Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Left sidebar → click **Pages**
4. Under "Source" → select **Deploy from a branch**
5. Branch: **main** | Folder: **/ (root)**
6. Click **Save**
7. Wait 2-3 minutes → GitHub will show your live URL:
   `https://YOUR-GITHUB-USERNAME.github.io/oss-fuzzing-security-platform`

### Step 6 — Share the link with HOD
Your project is now live on the internet. Share this link:
```
https://YOUR-GITHUB-USERNAME.github.io/oss-fuzzing-security-platform
```

---

## 🎯 Demo Walkthrough (For HOD Presentation)

1. **Login** — Register with any name/email → Login
2. **Upload** — Click "Choose File" → select `sample_urls.txt` → click Proceed
3. **Dashboard** — See the main dashboard with 5 tabs
4. **Start Engine** — Click "▶ Start Fuzzing" → watch live counters
5. **Workflow Tab** — Show live pipeline animation + Throughput & Resolution charts
6. **Bug Types Tab** — Show live bar charts per bug type
7. **Analytics Tab** — Show pie chart, timeline, severity chart
8. **Pause & Resume** — Demonstrate freeze/resume without data loss
9. **Complete** — Let it finish → show STABLE banner → Export Report
10. **Reset** — Show full reset to zero state

---

## 📋 HOD Review Checklist

- [x] Live deployment link (GitHub Pages)
- [x] Source code repository (GitHub)
- [x] Local run via `node server.js` **or** `python app.py` → browser URL
- [x] All features functional and tested
- [x] Export report working
- [x] Live charts working (Throughput, Resolution Rate, Bug Types)
- [x] Engine states: Start / Pause / Resume / Hard Stop / Reset / Complete

---

*Project built as part of MCA Final Year curriculum — Osmania University*
