@echo off
title Project KAI Web Interface
echo ========================================================
echo  PROJECT KAI: MULTIMODAL AFFECTIVE COUNSELOR WEB SUITE
echo ========================================================
echo.
echo Launching local web bridge and core runtime...
cd /d "%~dp0KAI-Counselor-main"
python web_bridge.py
pause
