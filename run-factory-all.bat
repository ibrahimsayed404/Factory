@echo off
REM This script will start both the backend and frontend in separate terminals

start "Factory API" cmd /k "cd /d %~dp0factory-api && npm start"
start "Factory Client" cmd /k "cd /d %~dp0factory-client && npm start"
