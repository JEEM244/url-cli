namespace TabVault.Cli.Models;

public sealed record WindowCapture(
    int ProcessId,
    string? Title,
    string? Url,
    bool IsPrivate,
    string Status,
    bool Filtered);
