[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('help', 'info', 'doctor', 'capture', 'list')]
    [string]$Command = 'help',

    [string]$Output,

    [switch]$IncludePrivate
)

$ErrorActionPreference = 'Stop'
$script:TabVaultRoot = $PSScriptRoot
$script:TabVaultVersion = '0.1.0'

. (Join-Path $PSScriptRoot 'src/Edge/EdgeDiscovery.ps1')
. (Join-Path $PSScriptRoot 'src/Storage/JsonStore.ps1')

function Show-Help {
    @'
TabVault CLI - Local browser tab backup utility

Usage:
  pwsh ./tabvault.ps1 <command> [options]

Commands:
  help       Show this help.
  info       Show application information.
  doctor     Check the local capture prerequisites.
  capture    Capture the active tab exposed by each Edge window.
  list       List JSON backups.

Options:
  -Output <path>     Choose the JSON output path for capture.
  -IncludePrivate    Include InPrivate windows if their data is accessible.

Examples:
  pwsh ./tabvault.ps1 doctor
  pwsh ./tabvault.ps1 capture
  pwsh ./tabvault.ps1 capture -IncludePrivate
  pwsh ./tabvault.ps1 capture -Output ./backups/manual.json
  pwsh ./tabvault.ps1 list

Limitations:
  This first version captures at most the active tab of each Edge window.
  It does not enumerate every background tab or guarantee access to InPrivate.
  Sensitive/adult-looking tabs are excluded by a local title/URL filter.
'@
}

switch ($Command) {
    'help' {
        Show-Help
    }

    'info' {
        Write-Host "TabVault CLI v$script:TabVaultVersion" -ForegroundColor Cyan
        Write-Host 'Independent PowerShell tool for local Edge tab backups.'
        Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
        Write-Host "Platform: $([System.Environment]::OSVersion.Platform)"
        Write-Host "Root: $script:TabVaultRoot"
    }

    'doctor' {
        $report = Test-TabVaultEnvironment
        Write-Host ''
        Write-Host 'TabVault environment check' -ForegroundColor Cyan
        Write-Host "Windows: $($report.IsWindows)"
        Write-Host "UI Automation: $($report.UiAutomationAvailable)"
        Write-Host "Edge processes: $($report.EdgeProcessCount)"
        Write-Host "Edge windows: $($report.EdgeWindowCount)"
        if ($report.Issues.Count -gt 0) {
            Write-Host ''
            Write-Host 'Issues:' -ForegroundColor Yellow
            $report.Issues | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
        }
        else {
            Write-Host ''
            Write-Host 'No prerequisite issues detected.' -ForegroundColor Green
        }
    }

    'capture' {
        $windows = @(Get-EdgeWindowSnapshot -IncludePrivate:$IncludePrivate)
        $backup = New-TabVaultBackup -Windows $windows
        $savedPath = Save-TabVaultBackup -Backup $backup -OutputPath $Output

        Write-Host ''
        Write-Host 'TabVault capture' -ForegroundColor Cyan
        Write-Host "Windows inspected: $($backup.summary.windowsInspected)"
        Write-Host "Tabs captured: $($backup.summary.captured)"
        Write-Host "Partial records: $($backup.summary.partial)"
        Write-Host "Private windows skipped: $($backup.summary.privateWindowsSkipped)"
        Write-Host "Sensitive entries excluded: $($backup.summary.filtered)"
        Write-Host "Backup: $savedPath" -ForegroundColor Green
        Write-Host ''
        Write-Host 'Scope: active tab per accessible Edge window only.' -ForegroundColor Yellow
    }

    'list' {
        Get-TabVaultBackups -BackupDirectory (Join-Path $PSScriptRoot 'backups') |
            Format-Table -AutoSize
    }
}
