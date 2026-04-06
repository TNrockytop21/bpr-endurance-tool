; BPR Endurance Tool - Inno Setup Script
; Installs the BPR Agent and Stream Deck plugin

#define MyAppName "BPR Endurance Tool"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Bite Point Racing"
#define MyAppURL "http://45.55.216.21"
#define MyAppExeName "BPR-Agent.exe"

[Setup]
AppId={{B1T3P01NT-BPR-END-TOOL-2026}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\BPR Endurance Tool
DefaultGroupName=BPR Endurance Tool
LicenseFile=license.txt
OutputDir=output
OutputBaseFilename=BPR-Endurance-Tool-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallMode=x64compatible
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
SetupIconFile=..\streamdeck-plugin\com.bitepointracing.endurance.sdPlugin\imgs\plugin-icon.png

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "streamdeck"; Description: "Install Stream Deck plugin"; GroupDescription: "Stream Deck integration:"; Check: StreamDeckInstalled

[Files]
; BPR Agent executable
Source: "..\agent\dist\BPR-Agent.exe"; DestDir: "{app}"; Flags: ignoreversion

; Stream Deck plugin (entire folder)
Source: "..\streamdeck-plugin\com.bitepointracing.endurance.sdPlugin\*"; DestDir: "{userappdata}\Elgato\StreamDeck\Plugins\com.bitepointracing.endurance.sdPlugin"; Flags: ignoreversion recursesubdirs createallsubdirs; Tasks: streamdeck

[Icons]
Name: "{group}\BPR Endurance Tool"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\BPR Dashboard (Browser)"; Filename: "{#MyAppURL}"
Name: "{group}\Uninstall BPR Endurance Tool"; Filename: "{uninstallexe}"
Name: "{autodesktop}\BPR Endurance Tool"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch BPR Endurance Tool"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\Elgato\StreamDeck\Plugins\com.bitepointracing.endurance.sdPlugin"

[Messages]
WelcomeLabel2=This will install the BPR Endurance Tool on your computer.%n%nThis includes:%n  - BPR Agent (connects iRacing telemetry to the team dashboard)%n  - Stream Deck plugin (optional, for Stream Deck+ users)%n%nMake sure iRacing is NOT running during installation.
FinishedLabel=The BPR Endurance Tool has been installed.%n%nTo use:%n  1. Launch "BPR Endurance Tool" from your Start Menu%n  2. Enter your iRacing name and select your team%n  3. Click Connect%n  4. Start iRacing and join a session%n%nDashboard: {#MyAppURL}

[Code]
function StreamDeckInstalled: Boolean;
begin
  Result := DirExists(ExpandConstant('{userappdata}\Elgato\StreamDeck'));
end;
