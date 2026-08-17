# Publish DocumentSyncClient untuk Windows (release, single exe, self-contained)
# Jalankan dari folder ini:  .\scripts\publish-win.ps1
# Prasyarat: .NET 8 SDK

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$project = Join-Path $root "App\DocumentSyncClient.App\DocumentSyncClient.App.csproj"
$output = Join-Path $root "publish\win-x64"

Write-Host "Publishing $project -> $output" -ForegroundColor Cyan

dotnet publish $project `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o $output

if ($LASTEXITCODE -ne 0) {
    Write-Host "Publish FAILED." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Selesai! Jalankan: $output\DocumentSyncClient.App.exe" -ForegroundColor Green
Write-Host "Sekitar 100-200 MB (self-contained .NET + SQLite native)." -ForegroundColor Yellow
