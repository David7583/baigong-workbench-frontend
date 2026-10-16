# Rebuild the film using project-local dependencies and retained media assets.
param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'assets/voice_00.mp3'))) {
    throw 'Missing media assets. Extract the video project attachment into this directory first.'
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'Install FFmpeg and add it to PATH.' }
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) { throw 'Install FFprobe and add it to PATH.' }
$videoEnv = Join-Path $PSScriptRoot '.build/venv'
$videoPython = Join-Path $videoEnv 'Scripts/python.exe'
if (-not (Test-Path -LiteralPath $videoPython)) {
    & $Python -m venv $videoEnv
    if ($LASTEXITCODE -ne 0) { throw 'Could not create video virtual environment.' }
}
& $videoPython -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Video dependency installation failed.' }
& $videoPython (Join-Path $PSScriptRoot 'source/render.py')
if ($LASTEXITCODE -ne 0) { throw 'Video rendering or validation failed.' }
