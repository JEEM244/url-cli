# TabVault CLI

Independent PowerShell command-line utility for local Microsoft Edge tab backups.

## Status

**Prototype: v0.1.0**

The repository starts with a small CLI foundation and a conservative Windows UI Automation collector.

### Current capture scope

The first collector attempts to read the address bar exposed by each top-level Edge window. It can capture **at most one active tab per detected window**. It does not enumerate every background tab, tab group, or suspended tab.

UI Automation may not expose the address bar value in every Edge version or window state. Missing values are recorded as partial, not guessed.

InPrivate windows are skipped by default. The IncludePrivate switch asks the collector to inspect them too, but Edge may still withhold their information. This option does not bypass browser privacy protections.

A local title/URL filter excludes entries that appear to be adult-content pages. The filter is a precaution, not a guarantee of classification.

## Requirements

- Windows 10/11
- PowerShell 7+
- Microsoft Edge
- No browser extension
- No database
- No administrator privileges expected

## Usage

~~~powershell
pwsh ./tabvault.ps1 help
pwsh ./tabvault.ps1 info
pwsh ./tabvault.ps1 doctor
pwsh ./tabvault.ps1 capture
pwsh ./tabvault.ps1 capture -IncludePrivate
pwsh ./tabvault.ps1 capture -Output ./backups/manual.json
pwsh ./tabvault.ps1 list
~~~

## Output

Backups are JSON files stored in backups/ by default. The generated JSON files are ignored by Git so browsing history is not committed accidentally. Each entry records its capture status:

- captured: an HTTP(S) URL was read.
- partial: a window was detected but no usable URL was exposed.
- filtered: the entry matched the local sensitive-content filter and was omitted.
- private-window-skipped: an InPrivate window was skipped by default.

## Roadmap

- [x] Initial CLI structure
- [x] Environment diagnostics
- [x] JSON backup writer
- [x] Conservative active-tab collector
- [ ] Reliable background-tab enumeration without an extension
- [ ] Tab-group metadata
- [ ] Backup inspection and search commands
- [ ] Restore command with dry-run support
- [ ] Automated tests

## Important limitation

A standalone program cannot assume it can enumerate every Edge tab through supported Windows APIs. The current prototype deliberately reports its limited capture scope instead of claiming a complete session backup.
~~~
