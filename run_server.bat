@echo off
REM ============================================================
REM  FILE    : run_server.bat
REM  PROJECT : OSS Fuzzing Security Platform
REM  STUDENT : Kudikudi Akhil | H.T. 104324862027
REM  COLLEGE : UPG College (O.U.), Siddipet
REM
REM  This file starts the PYTHON (Flask) backend, which provides
REM  real login/register against the SQLite database, then opens
REM  your browser automatically.
REM
REM  FIRST TIME ONLY — install dependencies:
REM     pip install -r requirements.txt
REM
REM  TO STOP THE SERVER:
REM  Close this black window OR press Ctrl+C inside it.
REM ============================================================

echo.
echo  ===================================================================
echo   OSS FUZZING SECURITY PLATFORM
echo   Student : Kudikudi Akhil
echo   H.T. No : 104324862027
echo   College : UPG College (O.U.), Siddipet
echo  ===================================================================
echo.
echo  Starting Python (Flask) server...
echo.
echo  Once started, open your browser and visit:
echo.
echo       ^>^>  http://localhost:4000  ^<^<
echo.
echo  Leave this window OPEN while using the project.
echo  Press Ctrl+C here to stop the server.
echo  ===================================================================
echo.

REM Change directory to this file's folder.
cd /d "%~dp0"

REM Run the Flask app. Requires: pip install -r requirements.txt
python app.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Trying python3 command...
    echo.
    python3 app.py
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ===================================================================
    echo  ERROR: Could not start the Python server.
    echo  Make sure Python is installed and dependencies are set up:
    echo    1. Open this folder in VS Code terminal
    echo    2. Run: pip install -r requirements.txt
    echo    3. Run this file again
    echo  ===================================================================
    echo.
)

pause
