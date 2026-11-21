@echo off
set "BLUEDEAL_RESEARCH_PYTHON=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not exist "%BLUEDEAL_RESEARCH_PYTHON%" set "BLUEDEAL_RESEARCH_PYTHON=python"
"%BLUEDEAL_RESEARCH_PYTHON%" -c "import bs4" >nul 2>nul
if errorlevel 1 (
  echo Required Python module is missing. Run:
  echo python -m pip install -r "%~dp0requirements.txt"
  pause
  exit /b 1
)
"%BLUEDEAL_RESEARCH_PYTHON%" "%~dp0server.py" --open-browser %*
if errorlevel 1 pause
