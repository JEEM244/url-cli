using TabVault.Cli.Capture;
using TabVault.Cli.Diagnostics;
using TabVault.Cli.Models;
using TabVault.Cli.Storage;

namespace TabVault.Cli;

internal static class Program
{
    private const string Version = "0.2.0";

    private static int Main(string[] args)
    {
        try
        {
            return Run(args);
        }
        catch (PlatformNotSupportedException exception)
        {
            WriteError(exception.Message);
            return 2;
        }
        catch (Exception exception)
        {
            WriteError(exception.Message);
            return 1;
        }
    }

    private static int Run(string[] args)
    {
        var command = args.FirstOrDefault(argument => !argument.StartsWith('-'))?.ToLowerInvariant() ?? "help";

        switch (command)
        {
            case "help":
            case "--help":
            case "-h":
                ShowHelp();
                return 0;

            case "info":
            case "version":
                Console.WriteLine($"TabVault CLI v{Version}");
                Console.WriteLine("C# / .NET console application for local Microsoft Edge backups.");
                Console.WriteLine($"Runtime: {Environment.Version}");
                Console.WriteLine($"Platform: {Environment.OSVersion.Platform}");
                return 0;

            case "doctor":
                return RunDoctor();

            case "capture":
                return RunCapture(args);

            case "list":
                return RunList();

            case "test":
                return SelfTestRunner.Run();

            default:
                WriteError($"Unknown command: {command}");
                ShowHelp();
                return 2;
        }
    }

    private static int RunCapture(string[] args)
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException("TabVault capture requires Windows.");
        }

        var includePrivate = HasSwitch(args, "--include-private", "-includeprivate");
        var outputPath = GetOption(args, "--output", "-output");

        var windows = new EdgeCapture().Capture(includePrivate);
        var backup = BackupDocument.Create(windows);
        var savedPath = BackupStore.Save(backup, outputPath);

        Console.WriteLine();
        Console.WriteLine("TabVault capture");
        Console.WriteLine($"Windows inspected: {backup.Summary.WindowsInspected}");
        Console.WriteLine($"Tabs captured: {backup.Summary.Captured}");
        Console.WriteLine($"Partial records: {backup.Summary.Partial}");
        Console.WriteLine($"Unavailable windows: {backup.Summary.Unavailable}");
        Console.WriteLine($"Private windows skipped: {backup.Summary.PrivateWindowsSkipped}");
        Console.WriteLine($"Filtered entries: {backup.Summary.Filtered}");
        Console.WriteLine($"  - InPrivate windows: {backup.Summary.FilteredPrivate}");
        Console.WriteLine($"  - Regular windows: {backup.Summary.FilteredRegular}");
        Console.WriteLine($"Backup: {savedPath}");
        Console.WriteLine();
        Console.WriteLine("Scope: one active tab per accessible Edge window.");

        return 0;
    }

    private static int RunDoctor()
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException("TabVault capture requires Windows.");
        }

        var edgeProcesses = System.Diagnostics.Process.GetProcessesByName("msedge");
        var capture = new EdgeCapture();
        var windows = capture.Capture(includePrivate: false);

        Console.WriteLine("TabVault environment check");
        Console.WriteLine($"Windows: {OperatingSystem.IsWindows()}");
        Console.WriteLine("UI Automation: available");
        Console.WriteLine($"Edge processes: {edgeProcesses.Length}");
        Console.WriteLine($"Edge windows: {windows.Count}");

        foreach (var process in edgeProcesses)
        {
            process.Dispose();
        }

        if (edgeProcesses.Length == 0)
        {
            Console.WriteLine("Issue: Microsoft Edge is not running.");
            return 1;
        }

        if (windows.Count == 0)
        {
            Console.WriteLine("Issue: Edge is running, but no top-level browser window was detected.");
            return 1;
        }

        Console.WriteLine("No prerequisite issues detected.");
        return 0;
    }

    private static int RunList()
    {
        var files = BackupStore.List();
        if (files.Count == 0)
        {
            Console.WriteLine("No backups found.");
            return 0;
        }

        Console.WriteLine($"{"Name",-34} {"Size",10} {"Last modified",-22}");
        foreach (var file in files)
        {
            Console.WriteLine($"{file.Name,-34} {file.Length,10} {file.LastWriteTime,-22:g}");
        }

        return 0;
    }

    private static bool HasSwitch(string[] args, params string[] names) =>
        args.Any(argument => names.Any(name =>
            argument.Equals(name, StringComparison.OrdinalIgnoreCase)));

    private static string? GetOption(string[] args, params string[] names)
    {
        for (var index = 0; index < args.Length - 1; index++)
        {
            if (names.Any(name => args[index].Equals(name, StringComparison.OrdinalIgnoreCase)))
            {
                return args[index + 1];
            }
        }

        return null;
    }

    private static void ShowHelp()
    {
        Console.WriteLine("""
        TabVault CLI - local Microsoft Edge tab backups

        Usage:
          dotnet run --project src/TabVault.Cli -- <command> [options]

        Commands:
          help       Show this help.
          info       Show application and runtime information.
          doctor     Check Windows, UI Automation and Edge.
          capture    Save the active tab exposed by each Edge window.
          list       List JSON backups.
          test       Run built-in regression and privacy tests.

        Options:
          --include-private   Inspect InPrivate windows when their UI data is exposed.
          --output <path>     Write the backup to a chosen JSON path.

        Examples:
          dotnet run --project src/TabVault.Cli -- doctor
          dotnet run --project src/TabVault.Cli -- capture
          dotnet run --project src/TabVault.Cli -- capture --include-private
          dotnet run --project src/TabVault.Cli -- capture --output ./backups/manual.json
          dotnet run --project src/TabVault.Cli -- test

        Scope and privacy:
          - Captures at most one active tab per detected Edge window.
          - Does not enumerate background tabs or tab groups.
          - InPrivate is opt-in and is not a browser-protection bypass.
          - Filtered entries are never stored in the backup.
        """);
    }

    private static void WriteError(string message)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.Error.WriteLine($"Error: {message}");
        Console.ResetColor();
    }
}
