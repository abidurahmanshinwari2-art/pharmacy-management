$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $root) { $root = Get-Location }
$iconPath = Join-Path $root 'pharmacy.ico'
$batPath = Join-Path $root 'start-pharmacy.bat'
$name = 'Pharmacy Management System'

if (-not (Test-Path $batPath)) { exit 0 }

function Add-PharmacyShortcut([string]$folder) {
  if (-not (Test-Path $folder)) { return }
  $lnkPath = Join-Path $folder "$name.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($lnkPath)
  $lnk.TargetPath = $batPath
  $lnk.WorkingDirectory = $root
  $lnk.WindowStyle = 1
  $lnk.Description = 'Open Pharmacy Management System'
  if (Test-Path $iconPath) { $lnk.IconLocation = $iconPath }
  $lnk.Save()
}

$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
Add-PharmacyShortcut $desktop
Add-PharmacyShortcut $startMenu
