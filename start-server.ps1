Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KAITOARTZ - Local Server Launcher" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting server on http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Try Python first
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "Using Python HTTP Server..." -ForegroundColor Green
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8000"
    python -m http.server 8000
}
# Try Node.js http-server
elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "Using Node.js http-server..." -ForegroundColor Green
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8000"
    npx http-server -p 8000
}
# Try PHP
elseif (Get-Command php -ErrorAction SilentlyContinue) {
    Write-Host "Using PHP Built-in Server..." -ForegroundColor Green
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8000"
    php -S localhost:8000
}
else {
    Write-Host "ERROR: No server available!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install one of these:" -ForegroundColor Yellow
    Write-Host "  1. Python: https://www.python.org/downloads/" -ForegroundColor White
    Write-Host "  2. Node.js: https://nodejs.org/" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use VS Code 'Live Server' extension" -ForegroundColor Cyan
    pause
}
