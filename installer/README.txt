================================================
  BPR Endurance Tool - Setup Guide
  Bite Point Racing
================================================

WHAT'S INCLUDED:
  - BPR-Agent.exe     (Telemetry agent for iRacing)
  - StreamDeck Plugin (For Stream Deck+ users)


== TELEMETRY AGENT SETUP ==

1. Copy BPR-Agent.exe anywhere on your PC (Desktop is fine)
2. Double-click BPR-Agent.exe
3. Enter your iRacing display name
4. Select your team (Team A, Team B, etc.)
5. Click Connect
6. Launch iRacing and join a session
7. Your telemetry will appear on the team dashboard

Dashboard: http://45.55.216.21


== STREAM DECK SETUP (Optional) ==

STEP 1: Install the plugin

  1. Close the Stream Deck app completely
     (Right-click the Stream Deck icon in system tray > Quit)

  2. Open this folder in File Explorer:
     %APPDATA%\Elgato\StreamDeck\Plugins\

     (Copy/paste that path into the File Explorer address bar)

  3. Copy the entire "com.bitepointracing.endurance.sdPlugin" folder
     from this zip into that Plugins folder

  4. Re-open the Stream Deck app

STEP 2: Import the pre-made profile

  1. Double-click "BPR Endurance Tool.streamDeckProfile" from this zip
  2. The Stream Deck app will import it automatically
  3. All buttons and dials are pre-configured!

OR set up manually:

  1. In the Stream Deck app, look for "BPR Racing" in the
     action list on the right side
  2. Drag "Switch Page" buttons onto your keys
     - Click each button to set which page it navigates to
  3. Click the "Dials" tab at the top to configure rotary dials
     - Drag "BPR Zoom Telemetry", "BPR Scroll Page", or
       "BPR Switch Team" onto your dials


== TROUBLESHOOTING ==

Agent won't connect:
  - Make sure you have internet access
  - Check that the server URL shows http://45.55.216.21

Agent says "Waiting for iRacing":
  - This is normal - launch iRacing and join a session
  - The agent auto-detects when iRacing starts

Stream Deck buttons don't work:
  - Make sure the dashboard is open in your browser
  - Check the Server field in the button settings shows
    http://45.55.216.21

Need help? Contact your team admin.
