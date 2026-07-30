#ifndef AppVersion
  #error AppVersion must be provided with /DAppVersion=x.y.z
#endif

#ifndef PackageRoot
  #error PackageRoot must be provided with /DPackageRoot=path
#endif

#ifndef LauncherPath
  #error LauncherPath must be provided with /DLauncherPath=path
#endif

#define AppGuid "{{20c4b086-48b0-44cf-acd1-b70014c6573a}"
#define AppName "月海 WorkBuddy"

[Setup]
AppId={#AppGuid}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=月海
AppPublisherURL=https://github.com/413162826/moonsea-codex-theme
AppSupportURL=https://github.com/413162826/moonsea-codex-theme/issues
AppUpdatesURL=https://github.com/413162826/moonsea-codex-theme/releases
DefaultDirName={localappdata}\MoonseaWorkBuddy
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
WizardSizePercent=115
Compression=lzma2/ultra64
SolidCompression=yes
OutputBaseFilename=Moonsea-WorkBuddy-Windows-x64-Setup
SetupIconFile=moonsea.ico
UninstallDisplayIcon={app}\MoonseaWorkBuddyLauncher.exe
UninstallDisplayName={#AppName}
Uninstallable=yes
UninstallLogging=yes
CloseApplications=yes
RestartApplications=no
ChangesAssociations=no
ChangesEnvironment=no
UsePreviousAppDir=yes
SetupLogging=yes
VersionInfoVersion={#AppVersion}
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}
VersionInfoCompany=Moonsea
VersionInfoDescription=月海 WorkBuddy 安装程序

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Default.isl"

[Messages]
SetupAppTitle=安装
SetupWindowTitle=安装 - %1
UninstallAppTitle=卸载
UninstallAppFullTitle=卸载 %1
InformationTitle=信息
ConfirmTitle=确认
ErrorTitle=错误
ButtonBack=< 上一步(&B)
ButtonNext=下一步(&N) >
ButtonInstall=安装(&I)
ButtonOK=确定
ButtonCancel=取消
ButtonYes=是(&Y)
ButtonNo=否(&N)
ButtonFinish=完成(&F)
ClickNext=点击“下一步”继续，或点击“取消”退出安装程序。
WelcomeLabel1=欢迎使用 [name] 安装向导
WelcomeLabel2=即将在您的电脑上安装 [name/ver]。%n%n安装过程不会修改官方 WorkBuddy。
WizardSelectDir=选择安装位置
SelectDirDesc=月海 WorkBuddy 将安装在哪里？
SelectDirLabel3=安装程序将把 [name] 安装到下面的文件夹。
SelectDirBrowseLabel=点击“下一步”继续；如需更换位置，请点击“浏览”。
WizardSelectTasks=选择附加选项
SelectTasksDesc=选择需要创建的快捷方式
SelectTasksLabel2=选择附加选项，然后点击“下一步”继续。
WizardReady=准备安装
ReadyLabel1=安装程序已准备好安装 [name]。
ReadyLabel2a=点击“安装”开始；如需修改设置，请点击“上一步”。
ReadyLabel2b=点击“安装”开始。
ReadyMemoDir=安装位置：
ReadyMemoTasks=附加选项：
WizardPreparing=正在准备
PreparingDesc=安装程序正在准备 [name]。
WizardInstalling=正在安装
InstallingLabel=正在安装 [name]，请稍候。
FinishedHeadingLabel=[name] 已安装
FinishedLabelNoIcons=[name] 已安装到您的电脑。
FinishedLabel=[name] 已安装到您的电脑，可通过快捷方式启动。
ClickFinish=点击“完成”退出安装程序。
RunEntryExec=启动 %1
ExitSetupTitle=退出安装
ExitSetupMessage=安装尚未完成。现在退出将不会安装月海 WorkBuddy。%n%n确定退出吗？
SetupAborted=安装没有完成。%n%n请修正问题后重新运行安装程序。
ConfirmUninstall=确定要卸载 %1 吗？官方 WorkBuddy 与登录资料不会受影响。
UninstallStatusLabel=正在从您的电脑中移除 %1，请稍候。
UninstalledAll=%1 已成功卸载。
UninstalledMost=%1 已卸载。%n%n有少量文件未能删除，重启电脑后可再次清理。

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："; Flags: unchecked

[Files]
Source: "{#PackageRoot}\*"; DestDir: "{app}\payload"; \
  Excludes: "\Install.cmd,\Uninstall.cmd,\scripts\windows\Build-Moonsea-Setup.ps1"; \
  Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#LauncherPath}"; DestDir: "{app}"; DestName: "MoonseaWorkBuddyLauncher.exe"; Flags: ignoreversion

[Icons]
Name: "{group}\月海 WorkBuddy"; Filename: "{app}\MoonseaWorkBuddyLauncher.exe"; WorkingDir: "{app}"
Name: "{group}\卸载月海 WorkBuddy"; Filename: "{uninstallexe}"
Name: "{autodesktop}\月海 WorkBuddy"; Filename: "{app}\MoonseaWorkBuddyLauncher.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\payload\scripts\windows\Uninstall-Moonsea-WorkBuddy-Windows.ps1"" -InstallRoot ""{app}"" -NonInteractive"; \
  Flags: runhidden waituntilterminated; RunOnceId: "MoonseaCleanup"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\builds"
Type: filesandordirs; Name: "{app}\releases"
Type: filesandordirs; Name: "{app}\updates"
Type: filesandordirs; Name: "{app}\logs"
Type: files; Name: "{app}\install.json"
Type: files; Name: "{app}\Start-Moonsea-WorkBuddy-Windows.ps1"
Type: files; Name: "{app}\manager.pid"

[Run]
Filename: "{app}\MoonseaWorkBuddyLauncher.exe"; Description: "启动月海 WorkBuddy"; \
  Flags: nowait postinstall skipifsilent; Check: IsRegularInstall

[Code]
var
  HadWorkingInstallation: Boolean;

function HasCommandLineParameter(const Expected: String): Boolean;
var
  Index: Integer;
begin
  Result := False;
  for Index := 1 to ParamCount do
  begin
    if CompareText(ParamStr(Index), Expected) = 0 then
    begin
      Result := True;
      Exit;
    end;
  end;
end;

function IsUpdateMode: Boolean;
begin
  Result := HasCommandLineParameter('/MOONSEAUPDATE');
end;

function IsRegularInstall: Boolean;
begin
  Result := not IsUpdateMode;
end;

function ExplicitInstallRoot: String;
var
  Index: Integer;
  Argument: String;
begin
  Result := '';
  for Index := 1 to ParamCount do
  begin
    Argument := ParamStr(Index);
    if CompareText(Copy(Argument, 1, 5), '/DIR=') = 0 then
    begin
      Result := Copy(Argument, 6, MaxInt);
      if (Length(Result) >= 2) and
        (Result[1] = '"') and
        (Result[Length(Result)] = '"') then
      begin
        Result := Copy(Result, 2, Length(Result) - 2);
      end;
      Result := RemoveBackslashUnlessRoot(Result);
      Exit;
    end;
  end;
end;

function ResolveUpdateInstallRoot: String;
begin
  Result := ExplicitInstallRoot;
  if Result = '' then
  begin
    Result := RemoveBackslashUnlessRoot(
      ExtractFileDir(ExtractFileDir(ExpandConstant('{srcexe}')))
    );
  end;
  if not FileExists(AddBackslash(Result) + 'install.json') or
    not FileExists(AddBackslash(Result) + 'Start-Moonsea-WorkBuddy-Windows.ps1') then
  begin
    RaiseException(
      '无法确认当前月海安装位置。请从月海助手重新下载更新，或运行完整安装包。'
    );
  end;
end;

procedure InitializeWizard;
begin
  if IsUpdateMode then
    WizardForm.DirEdit.Text := ResolveUpdateInstallRoot;
end;

procedure RemoveFailedInstallShortcuts;
begin
  DeleteFile(ExpandConstant('{group}\月海 WorkBuddy.lnk'));
  DeleteFile(ExpandConstant('{autodesktop}\月海 WorkBuddy.lnk'));
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  PowerShellPath: String;
  InstallerPath: String;
  LauncherPath: String;
  Parameters: String;
begin
  if CurStep = ssInstall then
  begin
    if IsUpdateMode and
      (CompareText(
        RemoveBackslashUnlessRoot(ExpandConstant('{app}')),
        ResolveUpdateInstallRoot
      ) <> 0) then
    begin
      RaiseException('更新安装目录与当前月海目录不一致，已经停止更新。');
    end;
    HadWorkingInstallation :=
      FileExists(ExpandConstant('{app}\install.json')) and
      FileExists(ExpandConstant('{app}\Start-Moonsea-WorkBuddy-Windows.ps1'));
    Exit;
  end;

  if CurStep <> ssPostInstall then
    Exit;

  PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  InstallerPath := ExpandConstant('{app}\payload\scripts\windows\Invoke-Moonsea-Install.ps1');
  Parameters :=
    '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
    InstallerPath + '" -InstallRoot "' + ExpandConstant('{app}') +
    '" -SkipShortcut -SkipLaunch';

  WizardForm.StatusLabel.Caption := '正在为 WorkBuddy 准备月海…';
  Log('Launching Moonsea installation engine: ' + InstallerPath);
  if not Exec(PowerShellPath, Parameters, ExpandConstant('{app}\payload'),
    SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    RaiseException('无法启动月海安装引擎。');
  end;
  if ResultCode <> 0 then
  begin
    if not HadWorkingInstallation then
      RemoveFailedInstallShortcuts;
    RaiseException(
      '月海没有安装完成。请查看 ' +
      ExpandConstant('{app}\logs') + ' 中的安装日志后重试。'
    );
  end;

  if IsUpdateMode then
  begin
    LauncherPath := ExpandConstant('{app}\MoonseaWorkBuddyLauncher.exe');
    Log('Restarting the updated Moonsea app: ' + LauncherPath);
    if not Exec(LauncherPath, '--update-restart', ExpandConstant('{app}'),
      SW_HIDE, ewNoWait, ResultCode) then
    begin
      RaiseException('月海已经更新，但无法自动重新启动。请通过快捷方式重新打开。');
    end;
  end;
end;
