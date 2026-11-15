using System.Text.RegularExpressions;

namespace TabVault.Cli.Capture;

public static partial class SensitiveEntryFilter
{
    private static readonly Regex[] Patterns =
    [
        new(@"\b(porn(?:ography)?|porno|xxx|hentai|nsfw)\b",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
        new(@"\badult[\s._/-]*content\b",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
        new(@"\b(adult|erotic)[\s._/-]+(videos?|images?|sites?|media)\b",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
    ];

    public static bool IsSensitive(string? title, string? url)
    {
        // Do not block a page only because the word "adult" appears on its own.
        // This avoids false positives such as "Adult Education".
        foreach (var candidate in new[] { title, url })
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            if (Patterns.Any(pattern => pattern.IsMatch(candidate)))
            {
                return true;
            }
        }

        return false;
    }
}
