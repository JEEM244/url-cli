function New-TabVaultBackup {
    param(
        [Parameter(Mandatory)]
        [object[]]$Windows
    )

    $captured = @($Windows | Where-Object status -eq 'captured').Count
    $partial = @($Windows | Where-Object status -eq 'partial').Count
    $filtered = @($Windows | Where-Object filtered).Count
    $privateSkipped = @($Windows | Where-Object status -eq 'private-window-skipped').Count

    $tabs = @(
        $Windows |
            Where-Object { $_.status -in @('captured', 'partial') } |
            ForEach-Object {
                [pscustomobject]@{
                    title = $_.title
                    url = $_.url
                    status = $_.status
                    isPrivate = $_.isPrivate
                    processId = $_.processId
                }
            }
    )

    [pscustomobject]@{
        application = 'TabVault'
        version = '0.1.0'
        browser = 'Microsoft Edge'
        createdAt = (Get-Date).ToUniversalTime().ToString('o')
        captureMode = 'active-tab-per-window'
        summary = [pscustomobject]@{
            windowsInspected = $Windows.Count
            captured = $captured
            partial = $partial
            privateWindowsSkipped = $privateSkipped
            filtered = $filtered
        }
        tabs = $tabs
    }
}

function Save-TabVaultBackup {
    param(
        [Parameter(Mandatory)]
        [object]$Backup,

        [string]$OutputPath
    )

    $backupDirectory = Join-Path $PSScriptRoot '../../backups'
    $backupDirectory = [System.IO.Path]::GetFullPath($backupDirectory)
    if (-not (Test-Path $backupDirectory)) {
        New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    }

    if ([string]::IsNullOrWhiteSpace($OutputPath)) {
        $fileName = 'backup_{0}.json' -f (Get-Date -Format 'yyyyMMdd_HHmmss')
        $OutputPath = Join-Path $backupDirectory $fileName
    }
    else {
        $OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
        $parent = Split-Path -Parent $OutputPath
        if ($parent -and -not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
    }

    $json = $Backup | ConvertTo-Json -Depth 8
    Set-Content -LiteralPath $OutputPath -Value $json -Encoding utf8
    return $OutputPath
}

function Get-TabVaultBackups {
    param(
        [Parameter(Mandatory)]
        [string]$BackupDirectory
    )

    if (-not (Test-Path $BackupDirectory)) {
        Write-Host 'No backups directory found.'
        return
    }

    Get-ChildItem -LiteralPath $BackupDirectory -Filter '*.json' -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object Name, Length, LastWriteTime, FullName
}
