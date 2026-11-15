using System.Text.Json;
using System.Text.Json.Serialization;

namespace TabVault.Cli.Models;

public sealed record TabEntry(
    string? Title,
    string? Url,
    string Status,
    bool IsPrivate,
    int ProcessId);

public sealed record BackupSummary(
    int WindowsInspected,
    int Captured,
    int Partial,
    int Unavailable,
    int PrivateWindowsSkipped,
    int Filtered,
    int FilteredPrivate,
    int FilteredRegular);

public sealed record BackupDocument(
    string Application,
    string Version,
    string Browser,
    DateTime CreatedAt,
    string CaptureMode,
    BackupSummary Summary,
    IReadOnlyList<TabEntry> Tabs)
{
    public static BackupDocument Create(IReadOnlyCollection<WindowCapture> windows)
    {
        var filtered = windows.Where(window => window.Filtered).ToArray();
        var tabs = windows
            .Where(window => window.Status is "captured" or "partial")
            .Select(window => new TabEntry(
                window.Title,
                window.Url,
                window.Status,
                window.IsPrivate,
                window.ProcessId))
            .ToArray();

        var summary = new BackupSummary(
            WindowsInspected: windows.Count,
            Captured: windows.Count(window => window.Status == "captured"),
            Partial: windows.Count(window => window.Status == "partial"),
            Unavailable: windows.Count(window => window.Status == "unavailable"),
            PrivateWindowsSkipped: windows.Count(window => window.Status == "private-window-skipped"),
            Filtered: filtered.Length,
            FilteredPrivate: filtered.Count(window => window.IsPrivate),
            FilteredRegular: filtered.Count(window => !window.IsPrivate));

        return new BackupDocument(
            Application: "TabVault",
            Version: "0.2.0",
            Browser: "Microsoft Edge",
            CreatedAt: DateTime.UtcNow,
            CaptureMode: "active-tab-per-window",
            Summary: summary,
            Tabs: tabs);
    }

    public static JsonSerializerOptions CreateJsonOptions() => new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}
