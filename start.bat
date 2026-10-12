@echo off
REM ============================================================
REM  McBuddy AI - one-click launcher (Windows)
REM
REM  This file is intentionally ASCII-only.
REM  cmd.exe mis-parses non-ASCII characters inside .bat files
REM  (it splits lines at the wrong byte offset under UTF-8 code
REM  pages, breaking URLs and treating punctuation as commands).
REM  All user-facing messages are printed by scripts\launch.py,
REM  which handles UTF-8 reliably.
REM ============================================================

setlocal
cd /d "%~dp0"

set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
    where python >nul 2>nul && set "PY=python"
)

if not defined PY (
    echo.
    echo   [ERROR] Python not found.
    echo.
    echo   Please install Python 3.10 or newer:
    echo     https://www.python.org/downloads/
    echo   Remember to check "Add Python to PATH" during setup.
    echo.
    pause
    exit /b 1
)

%PY% "%~dp0scripts\launch.py"
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
    echo.
    echo   Launcher exited with code %EXITCODE%.
    pause
)

exit /b %EXITCODE%
