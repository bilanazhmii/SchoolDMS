# Publish DocumentSyncClient untuk Windows (release, single exe, self-contained)
# Jalankan dari folder ini:  .\scripts\publish-win.ps1
# Prasyarat: .NET 8 SDK

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$project = Join-Path $root "App\DocumentSyncClient.App\DocumentSyncClient.App.csproj"
$output = Join-Path $root "publish\win-x64"

Write-Host "Publishing $project -> $output" -ForegroundColor Cyan

# Stop a running published client so the single-file executable is not locked.
Get-Process -Name "DocumentSyncClient.App" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping running DocumentSyncClient.App (PID $($_.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

$publishArgs = @(
    "publish", $project,
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "--no-restore",
    "-p:PublishSingleFile=true",
    "-p:IncludeNativeLibrariesForSelfExtract=true",
    "-o", $output
)

# SDK 10.0.400 can fail inside NuGet.targets during restore on some Windows
# installations (Value cannot be null, Parameter 'path1'). The project may
# already have valid assets from a successful build, so publish without a
# second restore first. If assets are missing, fall back to a normal restore.
Write-Host "Publishing using existing restore assets..." -ForegroundColor DarkCyan
dotnet @publishArgs
$publishExitCode = $LASTEXITCODE

if ($publishExitCode -ne 0) {
    Write-Host "Publish without restore failed; attempting package restore..." -ForegroundColor Yellow
    dotnet restore $project -r win-x64
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Restore FAILED. Repair or install a supported .NET 8 SDK, then run this script again." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    dotnet @publishArgs
    $publishExitCode = $LASTEXITCODE
}

if ($publishExitCode -ne 0) {
    Write-Host "Publish FAILED." -ForegroundColor Red
    exit $publishExitCode
}

Write-Host ""
Write-Host "Selesai! Jalankan: $output\SchoolDMS.Sync.exe" -ForegroundColor Green

Write-Host "Sekitar 100-200 MB (self-contained .NET + SQLite native)." -ForegroundColor Yellow
