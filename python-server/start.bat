@echo off
echo ===================================
echo  Mahdee AI - Image Generation Server
echo ===================================
echo.

cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

REM Check if venv exists, create if not
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate venv
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt -q

echo.
echo Starting image generation server...
echo (First run will download the FLUX.1-schnell model - ~24GB)
echo.
python server.py

pause
