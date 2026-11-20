@echo off
setlocal
title Engineer Prep

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1" -OpenBrowser %*
set "APP_EXIT=%ERRORLEVEL%"

if not "%APP_EXIT%"=="0" (
    echo.
    echo Engineer Prep could not start. Review the message above.
    pause
)

exit /b %APP_EXIT%
