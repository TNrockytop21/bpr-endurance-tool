@echo off
echo ============================================
echo  BPR Endurance Tool - Installer Builder
echo ============================================
echo.

:: Set paths
set PYTHON=C:\Users\avala\AppData\Local\Programs\Python\Python314\python.exe
set PROJECT_ROOT=%~dp0..
set AGENT_DIR=%PROJECT_ROOT%\agent
set INSTALLER_DIR=%~dp0

:: Step 1: Build the Python agent as .exe
echo [1/3] Building BPR Agent executable...
cd /d "%AGENT_DIR%"
"%PYTHON%" -m PyInstaller --onefile --noconsole --name "BPR-Agent" launcher.py
if errorlevel 1 (
    echo ERROR: PyInstaller build failed!
    pause
    exit /b 1
)
echo       Built: agent\dist\BPR-Agent.exe
echo.

:: Step 2: Check for Inno Setup
echo [2/3] Checking for Inno Setup...
set ISCC=
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe
)
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set ISCC=C:\Program Files\Inno Setup 6\ISCC.exe
)
if "%ISCC%"=="" (
    echo ERROR: Inno Setup 6 not found!
    echo Download it free from: https://jrsoftware.org/isdl.php
    echo Install it, then run this script again.
    pause
    exit /b 1
)
echo       Found: %ISCC%
echo.

:: Step 3: Build the installer
echo [3/3] Building installer...
cd /d "%INSTALLER_DIR%"
mkdir output 2>nul
"%ISCC%" setup.iss
if errorlevel 1 (
    echo ERROR: Inno Setup compilation failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo  BUILD COMPLETE!
echo  Installer: installer\output\BPR-Endurance-Tool-Setup.exe
echo ============================================
echo.
echo Share this file with your team. They double-click
echo to install everything automatically.
echo.
pause
