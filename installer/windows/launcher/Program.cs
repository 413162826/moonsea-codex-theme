using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MoonseaLauncher;

internal static class Program
{
    private const uint ErrorIcon = 0x00000010;

    [DllImport("user32.dll", EntryPoint = "MessageBoxW", CharSet = CharSet.Unicode)]
    private static extern int MessageBox(IntPtr window, string text, string caption, uint type);

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            var installRoot = Path.GetFullPath(AppContext.BaseDirectory);
            var launcherScript = Path.Combine(installRoot, "Start-Moonsea-Windows.ps1");
            if (!File.Exists(launcherScript))
            {
                throw new FileNotFoundException("月海启动组件缺失，请重新运行安装程序。", launcherScript);
            }

            var powershell = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                "System32",
                "WindowsPowerShell",
                "v1.0",
                "powershell.exe"
            );
            var forceRestart = args.Any(argument =>
                string.Equals(argument, "--update-restart", StringComparison.OrdinalIgnoreCase));
            var arguments = $"-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass " +
                $"-File \"{launcherScript}\"" +
                (forceRestart ? " -ForceRestart" : "");

            using (var process = Process.Start(new ProcessStartInfo
            {
                FileName = powershell,
                Arguments = arguments,
                WorkingDirectory = installRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            }))
            {
                if (process == null)
                {
                    throw new InvalidOperationException("无法启动月海。");
                }
                process.WaitForExit();
                if (process.ExitCode != 0)
                {
                    throw new InvalidOperationException($"月海启动失败（代码 {process.ExitCode}）。请重新运行安装程序修复。");
                }
            }
            return 0;
        }
        catch (Exception error)
        {
            MessageBox(IntPtr.Zero, error.Message, "月海 Codex", ErrorIcon);
            return 1;
        }
    }
}
