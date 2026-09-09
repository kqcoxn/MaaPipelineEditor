@echo off
REM Share the PowerShell installer so CMD uses the same managed runtime policy.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; try { Invoke-RestMethod 'https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/scripts/install/install.ps1' | Invoke-Expression } catch { Write-Error $_; exit 1 }"
exit /b %errorlevel%
