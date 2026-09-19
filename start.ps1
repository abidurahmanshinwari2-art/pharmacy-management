Write-Host "Starting PostgreSQL from D:\PostgreSQL\16..."
& "D:\PostgreSQL\start-postgres.ps1"

Write-Host "Starting backend and frontend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PORT='4050'; cd '$PSScriptRoot\backend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "Open http://localhost:5173"
Write-Host "The cards, pages, and views are the same as before."
Write-Host "Login: admin@pharmacy.local / admin123"
