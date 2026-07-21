on run
  set launcherPath to (system attribute "HOME") & "/Library/Application Support/MoonseaCodex/Start-Moonsea-macOS.command"
  do shell script "/bin/zsh " & quoted form of launcherPath & " >/dev/null 2>&1 &"
end run
