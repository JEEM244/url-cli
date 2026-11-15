# TabVault CLI

A local Microsoft Edge tab-backup utility built with **C# and .NET 10**. PowerShell is retained only as a small compatibility launcher.

## Status

**Prototype: v0.2.0**

The main application is a compiled .NET console program. It uses Windows UI Automation to read the address bar exposed by each top-level Edge window.

## Requirements

- Windows 10/11
- .NET 10 SDK
- Microsoft Edge
- No browser extension
- No database
- No administrator privileges expected

.NET 10 is the Long Term Support release used by this project.

## Build

From the repository root:

~~~powershell
dotnet --info
dotnet build .\src\TabVault.Cli\TabVault.Cli.csproj --configuration Release
~~~

## Usage

~~~powershell
dotnet run --project .\src\TabVault.Cli -- help
dotnet run --project .\src\TabVault.Cli -- info
dotnet run --project .\src\TabVault.Cli -- doctor
dotnet run --project .\src\TabVault.Cli -- capture
dotnet run --project .\src\TabVault.Cli -- capture --include-private
dotnet run --project .\src\TabVault.Cli -- capture --output .\backups\manual.json
dotnet run --project .\src\TabVault.Cli -- list
dotnet run --project .\src\TabVault.Cli -- test
~~~

The PowerShell launcher remains available for older commands:

~~~powershell
pwsh .\tabvault.ps1 capture
pwsh .\tabvault.ps1 capture -IncludePrivate
pwsh .\tabvault.ps1 doctor
pwsh .\tabvault.ps1 test
~~~

## Capture scope

- Captures **at most one active tab per detected Edge window**.
- Does not enumerate background tabs, tab groups, or suspended tabs.
- UI Automation may not expose a URL in every Edge version or window state. Those windows are recorded as partial or unavailable rather than guessing.
- InPrivate windows are skipped by default. --include-private opts into reading their exposed UI data; it does not bypass Edge protections.
- A conservative local filter discards entries matching explicit sensitive-content markers. Filtered titles and URLs are never written to the backup.

## JSON backups

Backups are saved under backups/ by default. The JSON summary includes capture counts and separates filtered regular windows from filtered InPrivate windows. It does not include the identifying text of filtered entries.

Generated browsing-history JSON files are ignored by Git.

## Tests

The built-in regression tests verify:
- InPrivate title detection.
- The sensitive-entry filter, including false-positive cases such as Adult Education.
- HTTP(S) URL validation.
- Capture-summary counts.
- That filtered titles and URLs never enter serialized JSON.

Run them with:

~~~powershell
dotnet run --project .\src\TabVault.Cli -- test
~~~

A Windows GitHub Actions workflow builds the project and runs the same tests on pushes and pull requests.

## Important limitation

A standalone program cannot guarantee access to every Edge tab through Windows UI Automation. TabVault reports its actual scope instead of claiming to back up a complete browser session.
