using System.Diagnostics;
using System.Windows.Automation;
using TabVault.Cli.Models;

namespace TabVault.Cli.Capture;

public sealed class EdgeCapture
{
    public IReadOnlyList<WindowCapture> Capture(bool includePrivate)
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException("TabVault capture requires Windows.");
        }

        var windows = GetEdgeTopLevelWindows();
        var results = new List<WindowCapture>(windows.Count);

        foreach (var window in windows)
        {
            var processId = 0;

            try
            {
                processId = window.Current.ProcessId;
                var title = window.Current.Name ?? string.Empty;
                var isPrivate = IsInPrivateWindow(title);

                if (isPrivate && !includePrivate)
                {
                    results.Add(new WindowCapture(
                        processId, null, null, true, "private-window-skipped", false));
                    continue;
                }

                var url = GetAddressBarValue(window);

                if (SensitiveEntryFilter.IsSensitive(title, url))
                {
                    // Filtered title and URL are deliberately discarded here.
                    results.Add(new WindowCapture(
                        processId, null, null, isPrivate, "filtered", true));
                    continue;
                }

                var validUrl = TryGetHttpUrl(url, out var normalizedUrl);

                results.Add(new WindowCapture(
                    processId,
                    title,
                    validUrl ? normalizedUrl : null,
                    isPrivate,
                    validUrl ? "captured" : "partial",
                    false));
            }
            catch
            {
                // Do not persist exception messages because UIA errors can contain
                // details from the browser window or its accessibility tree.
                results.Add(new WindowCapture(
                    processId, null, null, false, "unavailable", false));
            }
        }

        return results;
    }

    public static bool IsInPrivateWindow(string? title) =>
        !string.IsNullOrWhiteSpace(title) &&
        title.Contains("InPrivate", StringComparison.OrdinalIgnoreCase);

    public static bool TryGetHttpUrl(string? value, out string? url)
    {
        url = null;

        if (!Uri.TryCreate(value, UriKind.Absolute, out var parsed))
        {
            return false;
        }

        if (parsed.Scheme is not ("http" or "https"))
        {
            return false;
        }

        url = parsed.AbsoluteUri;
        return true;
    }

    private static List<AutomationElement> GetEdgeTopLevelWindows()
    {
        var processes = Process.GetProcessesByName("msedge");
        HashSet<int> processIds;

        try
        {
            processIds = processes.Select(process => process.Id).ToHashSet();
        }
        finally
        {
            foreach (var process in processes)
            {
                process.Dispose();
            }
        }

        if (processIds.Count == 0)
        {
            return [];
        }

        var root = AutomationElement.RootElement;
        var condition = new PropertyCondition(
            AutomationElement.ControlTypeProperty,
            ControlType.Window);
        var topLevelWindows = root.FindAll(TreeScope.Children, condition);
        var matches = new List<AutomationElement>();

        foreach (AutomationElement element in topLevelWindows)
        {
            try
            {
                if (processIds.Contains(element.Current.ProcessId))
                {
                    matches.Add(element);
                }
            }
            catch (ElementNotAvailableException)
            {
                // A browser window can close while the desktop tree is inspected.
            }
        }

        return matches;
    }

    private static string? GetAddressBarValue(AutomationElement window)
    {
        var addressCondition = new PropertyCondition(
            AutomationElement.AutomationIdProperty,
            "view_1017");

        var addressBar = window.FindFirst(TreeScope.Descendants, addressCondition);

        if (addressBar is null)
        {
            var editCondition = new PropertyCondition(
                AutomationElement.ControlTypeProperty,
                ControlType.Edit);
            var edits = window.FindAll(TreeScope.Descendants, editCondition);

            foreach (AutomationElement edit in edits)
            {
                var name = edit.Current.Name ?? string.Empty;
                if (name.Contains("Address", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("Dirección", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("Search", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("búsqueda", StringComparison.OrdinalIgnoreCase))
                {
                    addressBar = edit;
                    break;
                }
            }
        }

        if (addressBar is null)
        {
            return null;
        }

        try
        {
            if (addressBar.TryGetCurrentPattern(
                    ValuePattern.Pattern,
                    out var pattern))
            {
                return ((ValuePattern)pattern).Current.Value;
            }
        }
        catch (InvalidOperationException)
        {
            // Fall through to the Value property.
        }
        catch (ElementNotAvailableException)
        {
            return null;
        }

        try
        {
            var value = addressBar.GetCurrentPropertyValue(ValuePattern.ValueProperty);
            return value is string text ? text : null;
        }
        catch (ElementNotAvailableException)
        {
            return null;
        }
    }
}
