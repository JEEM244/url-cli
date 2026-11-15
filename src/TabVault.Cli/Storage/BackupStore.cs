using System.IO;
using System.Text;
using System.Text.Json;
using TabVault.Cli.Models;

namespace TabVault.Cli.Storage;

public static class BackupStore
{
    public static string GetBackupDirectory()
    {
        var root = FindRepositoryRoot();
        return Path.Combine(root, "backups");
    }

    public static string Save(BackupDocument backup, string? outputPath)
    {
        string destination;

        if (string.IsNullOrWhiteSpace(outputPath))
        {
            var directory = GetBackupDirectory();
            Directory.CreateDirectory(directory);
            var fileName = $"backup_{DateTime.Now:yyyyMMdd_HHmmss_fff}.json";
            destination = Path.Combine(directory, fileName);
        }
        else
        {
            destination = Path.GetFullPath(outputPath);
            var parent = Path.GetDirectoryName(destination);
            if (!string.IsNullOrEmpty(parent))
            {
                Directory.CreateDirectory(parent);
            }
        }

        var json = JsonSerializer.Serialize(backup, BackupDocument.CreateJsonOptions());
        var temporaryPath = destination + ".tmp";

        try
        {
            File.WriteAllText(temporaryPath, json, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            File.Move(temporaryPath, destination, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }

        return destination;
    }

    public static IReadOnlyList<FileInfo> List()
    {
        var directory = GetBackupDirectory();
        if (!Directory.Exists(directory))
        {
            return [];
        }

        return new DirectoryInfo(directory)
            .GetFiles("*.json")
            .OrderByDescending(file => file.LastWriteTime)
            .ToArray();
    }

    private static string FindRepositoryRoot()
    {
        var starts = new[] { Environment.CurrentDirectory, AppContext.BaseDirectory };

        foreach (var start in starts)
        {
            var current = new DirectoryInfo(start);
            while (current is not null)
            {
                if (File.Exists(Path.Combine(current.FullName, "tabvault.ps1")) &&
                    Directory.Exists(Path.Combine(current.FullName, "src")))
                {
                    return current.FullName;
                }

                current = current.Parent;
            }
        }

        return Environment.CurrentDirectory;
    }
}
