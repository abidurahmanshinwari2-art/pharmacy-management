$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $root) { $root = Get-Location }
$iconPath = Join-Path $root 'pharmacy.ico'
$batPath = Join-Path $root 'start-pharmacy.bat'
$name = 'Pharmacy Management System'

function New-PharmacyIcon([string]$path) {
  Add-Type -AssemblyName System.Drawing
  $size = 256
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(11, 61, 50))

  $leaf = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(11, 124, 86))
  $cream = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(236, 253, 248))
  $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(201, 162, 39))
  $deep = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(7, 40, 32))

  $g.FillEllipse($leaf, 18, 18, 220, 220)
  $g.FillEllipse($cream, 78, 46, 100, 100)
  $g.FillRectangle($leaf, 114, 58, 28, 76)
  $g.FillRectangle($leaf, 90, 82, 76, 28)
  $g.FillEllipse($deep, 70, 148, 116, 70)
  $g.FillEllipse($cream, 78, 154, 100, 48)
  $g.FillEllipse($gold, 188, 28, 28, 28)

  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $png = $ms.ToArray()
  $ms.Dispose()
  $g.Dispose()
  $bmp.Dispose()
  $leaf.Dispose()
  $cream.Dispose()
  $gold.Dispose()
  $deep.Dispose()

  $fs = [System.IO.File]::Create($path)
  $bw = New-Object System.IO.BinaryWriter $fs
  $bw.Write([uint16]0)
  $bw.Write([uint16]1)
  $bw.Write([uint16]1)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([uint16]1)
  $bw.Write([uint16]32)
  $bw.Write([uint32]$png.Length)
  $bw.Write([uint32]22)
  $bw.Write($png)
  $bw.Flush()
  $fs.Close()
}

if (-not (Test-Path $batPath)) { exit 0 }
if (-not (Test-Path $iconPath)) {
  try { New-PharmacyIcon $iconPath } catch { }
}

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
