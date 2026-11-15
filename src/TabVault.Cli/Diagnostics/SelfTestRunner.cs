using System.Text.Json;
using TabVault.Cli.Capture;
using TabVault.Cli.Models;
using TabVault.Cli.Storage;

namespace TabVault.Cli.Diagnostics;

public static class SelfTestRunner
{
    public static int Run()
    {
        var passed = 0;
        var failed = 0;

        void Check(string name, bool result)
        {
            if (result)
            {
                passed++;
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"PASS  {name}");
            }
            else
            {
                failed++;
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"FAIL  {name}");
            }

            Console.ResetColor();
        }

        Console.WriteLine("TabVault self-tests");
        Console.WriteLine();

        Check("Detects an InPrivate window", EdgeCapture.IsInPrivateWindow("Example - [InPrivate] - Microsoft Edge"));
        Check("Detects InPrivate without brackets", EdgeCapture.IsInPrivateWindow("Example - InPrivate"));
        Check("Does not mark a normal window private", !EdgeCapture.IsInPrivateWindow("Example - Microsoft Edge"));
        Check("Allows an empty title", !EdgeCapture.IsInPrivateWindow(string.Empty));

        Check("Allows example.com", !SensitiveEntryFilter.IsSensitive("Example Domain", "https://example.com/"));
        Check("Allows Adult Education (false-positive regression)", !SensitiveEntryFilter.IsSensitive("Adult Education - Course Guide", "https://example.edu/course"));
        Check("Allows a standalone use of the word adult", !SensitiveEntryFilter.IsSensitive("Adult learning resources", "https://example.edu/adult-learning"));
        Check("Allows Sex Education (false-positive regression)", !SensitiveEntryFilter.IsSensitive("Sex Education - Course Guide", "https://example.edu/health"));
        Check("Allows ordinary titles containing 'sex' as part of another word", !SensitiveEntryFilter.IsSensitive("Essex travel guide", "https://example.com/travel"));
        Check("Filters an explicit NSFW marker", SensitiveEntryFilter.IsSensitive("Example - NSFW", "https://example.com/"));
        Check("Filters an explicit category in a URL", SensitiveEntryFilter.IsSensitive("Example Domain", "https://example.com/category/hentai"));
        Check("Filters an explicit adult-content phrase", SensitiveEntryFilter.IsSensitive("Adult Content", "https://example.com/"));

        Check("Accepts HTTPS URLs", EdgeCapture.TryGetHttpUrl("https://example.com/", out _));
        Check("Accepts HTTP URLs", EdgeCapture.TryGetHttpUrl("http://example.com/", out _));
        Check("Rejects non-HTTP schemes", !EdgeCapture.TryGetHttpUrl("file:///C:/example.txt", out _));
        Check("Rejects invalid URLs", !EdgeCapture.TryGetHttpUrl("not a url", out _));

        var records = new[]
        {
            new WindowCapture(10, "Regular tab", "https://example.com/", false, "captured", false),
            new WindowCapture(11, "Private tab", "https://example.org/", true, "captured", false),
            new WindowCapture(12, "DO_NOT_STORE_PRIVATE_TITLE", "https://private.invalid/DO_NOT_STORE_PRIVATE_URL", true, "filtered", true),
            new WindowCapture(13, "DO_NOT_STORE_REGULAR_TITLE", "https://regular.invalid/DO_NOT_STORE_REGULAR_URL", false, "filtered", true),
            new WindowCapture(14, null, null, true, "private-window-skipped", false)
        };

        var backup = BackupDocument.Create(records);
        var json = JsonSerializer.Serialize(backup, BackupDocument.CreateJsonOptions());

        Check("Counts all inspected windows", backup.Summary.WindowsInspected == 5);
        Check("Counts captured tabs", backup.Summary.Captured == 2);
        Check("Counts filtered entries", backup.Summary.Filtered == 2);
        Check("Counts filtered InPrivate entries", backup.Summary.FilteredPrivate == 1);
        Check("Counts filtered regular entries", backup.Summary.FilteredRegular == 1);
        Check("Counts skipped InPrivate windows", backup.Summary.PrivateWindowsSkipped == 1);
        Check("Does not serialize filtered entries", backup.Tabs.Count == 2);
        Check("Does not serialize filtered private title", !json.Contains("DO_NOT_STORE_PRIVATE_TITLE", StringComparison.Ordinal));
        Check("Does not serialize filtered private URL", !json.Contains("DO_NOT_STORE_PRIVATE_URL", StringComparison.Ordinal));
        Check("Does not serialize filtered regular title", !json.Contains("DO_NOT_STORE_REGULAR_TITLE", StringComparison.Ordinal));
        Check("Does not serialize filtered regular URL", !json.Contains("DO_NOT_STORE_REGULAR_URL", StringComparison.Ordinal));
        Check("Keeps the InPrivate flag on captured records", backup.Tabs.Single(tab => tab.IsPrivate).IsPrivate);

        var temporaryDirectory = Path.Combine(Path.GetTempPath(), $"tabvault-test-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(temporaryDirectory);
            var targetPath = Path.Combine(temporaryDirectory, "backup.json");
            var savedPath = BackupStore.Save(backup, targetPath);
            var restored = JsonSerializer.Deserialize<BackupDocument>(
                File.ReadAllText(savedPath),
                BackupDocument.CreateJsonOptions());

            Check("Writes a JSON backup to disk", File.Exists(savedPath));
            Check("Reads the JSON backup back", restored is not null && restored.Summary.Captured == 2);
            Check("Keeps filtered records out of the saved JSON",
                restored is not null && restored.Tabs.Count == 2 &&
                !File.ReadAllText(savedPath).Contains("DO_NOT_STORE", StringComparison.Ordinal));
        }
        finally
        {
            if (Directory.Exists(temporaryDirectory))
            {
                Directory.Delete(temporaryDirectory, recursive: true);
            }
        }

        Console.ResetColor();
        Console.WriteLine();
        Console.WriteLine($"Results: {passed} passed, {failed} failed.");

        return failed == 0 ? 0 : 1;
    }
}
