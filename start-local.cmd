@echo off
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  node --env-file-if-exists=.env server.mjs
) else (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --env-file-if-exists=.env server.mjs
  ) else (
    echo Node.js 22.10 or newer is required to run Predix ora.
  )
)
pause
