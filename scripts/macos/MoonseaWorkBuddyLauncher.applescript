on run
  set launcherPath to (system attribute "HOME") & "/Library/Application Support/MoonseaWorkBuddy/Start-Moonsea-WorkBuddy-macOS.command"
  do shell script "/bin/zsh " & quoted form of launcherPath & " >/dev/null 2>&1 &"
end run
