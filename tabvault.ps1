[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('help', 'info', 'doctor', 'capture', 'list', 'test')]
    [string]$Command = 'help',

    [string]$Output,

    [switch]$IncludePrivate
)

$ErrorActionPreference = 'Stop'
$projectPath = Join-Path $PSScriptRoot 'src/TabVault.Cli/TabVault.Cli.csproj'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error 'The .NET 10 SDK is required. Install it, then run this command again.'
    exit 127
}

$cliArguments = @($Command)
if ($IncludePrivate) {
    $cliArguments += '--include-private'
}
if (-not [string]::IsNullOrWhiteSpace($Output)) {
    $cliArguments += @('--output', $Output)
}

& dotnet run --project $projectPath -- @cliArguments
exit $LASTEXITCODE
