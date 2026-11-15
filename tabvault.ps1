$ErrorActionPreference = 'Stop'

$projectPath = Join-Path $PSScriptRoot 'src/TabVault.Cli/TabVault.Cli.csproj'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error 'The .NET 10 SDK is required. Install it, then run this command again.'
    exit 127
}

& dotnet run --project $projectPath -- @args
exit $LASTEXITCODE
