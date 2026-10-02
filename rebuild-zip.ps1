# Align Theme ZIP builder — run from PowerShell
Add-Type -AssemblyName System.IO.Compression.FileSystem

$srcDir = "C:\Users\PC\Desktop\align-theme-extracted"
$zipOut = "C:\Users\PC\Desktop\connect\align-theme.zip"

if (Test-Path $zipOut) { [System.IO.File]::Delete($zipOut) }

$zip = [System.IO.Compression.ZipFile]::Open($zipOut, 'Create')

Get-ChildItem -Path $srcDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($srcDir.Length + 1).Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, 'Optimal') | Out-Null
}

$zip.Dispose()

$info = Get-Item $zipOut
Write-Host "Done: $([math]::Round($info.Length/1MB,2)) MB — $($info.FullName)" -ForegroundColor Green
Read-Host "Press Enter to close"
