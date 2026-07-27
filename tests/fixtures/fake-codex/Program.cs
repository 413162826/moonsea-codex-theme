using System.Diagnostics;

const string MainMarker = "--moonsea-fixture-main";

if (!args.Contains(MainMarker, StringComparer.Ordinal))
{
    var startInfo = new ProcessStartInfo
    {
        FileName = Environment.ProcessPath
            ?? throw new InvalidOperationException("Cannot locate the fixture executable."),
        UseShellExecute = false,
    };
    foreach (var argument in args)
    {
        startInfo.ArgumentList.Add(argument);
    }
    startInfo.ArgumentList.Add(MainMarker);
    Process.Start(startInfo);
    return;
}

using var shutdown = new ManualResetEventSlim(false);
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    shutdown.Set();
};
shutdown.Wait();
