function Initialize-TabVaultUIAutomation {
    if (-not $IsWindows) {
        throw 'TabVault capture currently requires Windows.'
    }

    try {
        Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
        Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
    }
    catch {
        throw "Could not load Windows UI Automation assemblies: $($_.Exception.Message)"
    }
}

function Get-EdgeTopLevelWindows {
    $edgeProcessIds = @(
        Get-Process -Name msedge -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty Id
    )

    if ($edgeProcessIds.Count -eq 0) {
        return @()
    }

    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $windowCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Window
    )

    $topLevel = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        $windowCondition
    )

    $matches = @(
        foreach ($element in $topLevel) {
            try {
                if ($edgeProcessIds -contains $element.Current.ProcessId) {
                    $element
                }
            }
            catch {
                continue
            }
        }
    )

    return $matches
}

function Get-EdgeAddressBarValue {
    param(
        [Parameter(Mandatory)]
        $Window
    )

    $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
        'view_1017'
    )

    $addressBar = $Window.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants,
        $condition
    )

    if (-not $addressBar) {
        $editCondition = [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Edit
        )
        $edits = $Window.FindAll(
            [System.Windows.Automation.TreeScope]::Descendants,
            $editCondition
        )

        foreach ($edit in $edits) {
            if ($edit.Current.Name -match 'Dirección|Address|búsqueda|search') {
                $addressBar = $edit
                break
            }
        }
    }

    if (-not $addressBar) {
        return $null
    }

    try {
        $pattern = $addressBar.GetCurrentPattern(
            [System.Windows.Automation.ValuePattern]::Pattern
        )
        return [string]$pattern.Current.Value
    }
    catch {
        try {
            $value = $addressBar.GetCurrentPropertyValue(
                [System.Windows.Automation.ValuePattern]::ValueProperty
            )
            if ($value -and $value -ne [System.Windows.Automation.AutomationElement]::NotSupported) {
                return [string]$value
            }
        }
        catch {
            return $null
        }
    }

    return $null
}

function Test-TabVaultSensitiveEntry {
    param(
        [string]$Title,
        [string]$Url
    )

    $candidate = "$Title $Url"
    $patterns = @(
        '(?i)\b(porn|porno|xxx|hentai|nsfw|adult)\b',
        '(?i)\bsex\b',
        '(?i)adult[-_/ ]?content'
    )

    foreach ($pattern in $patterns) {
        if ($candidate -match $pattern) {
            return $true
        }
    }

    return $false
}

function Get-EdgeWindowSnapshot {
    param(
        [switch]$IncludePrivate
    )

    Initialize-TabVaultUIAutomation
    $snapshots = [System.Collections.Generic.List[object]]::new()
    $edgeWindows = @(Get-EdgeTopLevelWindows)

    foreach ($window in $edgeWindows) {
        $processId = $null
        try {
            $processId = $window.Current.ProcessId
            $windowTitle = [string]$window.Current.Name
            $isPrivate = $windowTitle -match '\[InPrivate\]|InPrivate'

            if ($isPrivate -and -not $IncludePrivate) {
                $snapshots.Add([pscustomobject]@{
                    processId = $processId
                    title = $null
                    url = $null
                    isPrivate = $true
                    status = 'private-window-skipped'
                    filtered = $false
                })
                continue
            }

            $url = Get-EdgeAddressBarValue -Window $window
            $isFiltered = Test-TabVaultSensitiveEntry -Title $windowTitle -Url $url

            if ($isFiltered) {
                $snapshots.Add([pscustomobject]@{
                    processId = $processId
                    title = $null
                    url = $null
                    isPrivate = $isPrivate
                    status = 'filtered'
                    filtered = $true
                })
                continue
            }

            $validUrl = $false
            if (-not [string]::IsNullOrWhiteSpace($url)) {
                $parsed = $null
                $validUrl = [System.Uri]::TryCreate(
                    $url,
                    [System.UriKind]::Absolute,
                    [ref]$parsed
                ) -and $parsed.Scheme -in @('http', 'https')
            }

            $snapshots.Add([pscustomobject]@{
                processId = $processId
                title = $windowTitle
                url = if ($validUrl) { $url } else { $null }
                isPrivate = $isPrivate
                status = if ($validUrl) { 'captured' } else { 'partial' }
                filtered = $false
            })
        }
        catch {
            $snapshots.Add([pscustomobject]@{
                processId = $processId
                title = $null
                url = $null
                isPrivate = $false
                status = 'unavailable'
                filtered = $false
                error = $_.Exception.Message
            })
        }
    }

    return $snapshots.ToArray()
}

function Test-TabVaultEnvironment {
    $issues = [System.Collections.Generic.List[string]]::new()
    $uiAutomationAvailable = $false

    try {
        Initialize-TabVaultUIAutomation
        $uiAutomationAvailable = $true
    }
    catch {
        $issues.Add($_.Exception.Message)
    }

    $allEdge = @(Get-Process -Name msedge -ErrorAction SilentlyContinue)
    $edgeWindows = @()
    if ($uiAutomationAvailable) {
        $edgeWindows = @(Get-EdgeTopLevelWindows)
    }

    if ($allEdge.Count -eq 0) {
        $issues.Add('Microsoft Edge is not running.')
    }
    elseif ($edgeWindows.Count -eq 0) {
        $issues.Add('Edge is running, but no top-level browser window was detected.')
    }

    [pscustomobject]@{
        IsWindows = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
        UiAutomationAvailable = $uiAutomationAvailable
        EdgeProcessCount = $allEdge.Count
        EdgeWindowCount = $edgeWindows.Count
        Issues = $issues.ToArray()
    }
}
