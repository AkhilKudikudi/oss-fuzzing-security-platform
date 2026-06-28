@echo off
REM ============================================================
REM  FILE    : run_node_server.bat
REM  PROJECT : OSS Fuzzing Security Platform
REM  STUDENT : Kudikudi Akhil | H.T. 104324862027
REM  COLLEGE : UPG College (O.U.), Siddipet
REM
REM  This file starts the NODE.JS (Express) backend instead of
REM  the Python one. Same project, same database, same features —
REM  just a different backend language.
REM
REM  FIRST TIME ONLY — install dependencies:
REM     npm install
REM
REM  TO STOP THE SERVER:
REM  Close this black window OR press Ctrl+C inside it.
REM ============================================================

echo.
echo  ===================================================================
echo   OSS FUZZING SECURITY PLATFORM  (Node.js backend)
echo   Student : Kudikudi Akhil
echo   H.T. No : 104324862027
echo   College : UPG College (O.U.), Siddipet
echo  ===================================================================
echo.
echo  Starting Node.js (Express) server...
echo.
echo  Once started, open your browser and visit:
echo.
echo       ^>^>  http://localhost:4000  ^<^<
echo.
echo  Leave this window OPEN while using the project.
echo  Press Ctrl+C here to stop the server.
echo  ===================================================================
echo.

cd /d "%~dp0"
node server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ===================================================================
    echo  ERROR: Could not start the Node.js server.
    echo  Make sure Node.js is installed and dependencies are set up:
    echo    1. Open this folder in VS Code terminal
    echo    2. Run: npm install
    echo    3. Run this file again
    echo  ===================================================================
    echo.
)

pause
