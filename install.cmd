@echo off
setlocal
title Engineer Prep - Production Installer

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "INSTALL_EXIT=%ERRORLEVEL%"

if not "%INSTALL_EXIT%"=="0" (
    echo.
    echo Installation failed. Review the message above.
    pause
)

exit /b %INSTALL_EXIT%
