Write-Host "Starting pharmacy (Node.js only, same as the store)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PORT='4050'; cd '$PSScriptRoot\backend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "Open http://localhost:5173"
Write-Host "Login: admin@pharmacy.local / admin123"
