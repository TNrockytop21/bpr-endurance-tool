"""
BPR Endurance Tool - Driver Agent
Double-click to launch. Asks for your name, then auto-connects.
"""

import tkinter as tk
from tkinter import messagebox
import threading
import asyncio
import sys
import os

# Add the agent directory to path for imports
if getattr(sys, 'frozen', False):
    os.chdir(os.path.dirname(sys.executable))

from config import SERVER_URL, SEND_RATE_HZ
from protocol import hello_message, frame_message


class AgentGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("BPR Endurance Tool")
        self.root.geometry("380x340")
        self.root.resizable(False, False)
        self.root.configure(bg="#1a1d27")

        # Try to keep on top initially
        self.root.attributes("-topmost", True)
        self.root.after(1000, lambda: self.root.attributes("-topmost", False))

        # Title
        title = tk.Label(self.root, text="BPR", font=("Arial", 24, "bold"),
                        fg="white", bg="#ef4444", padx=10, pady=2)
        title.pack(pady=(15, 5))

        subtitle = tk.Label(self.root, text="Bite Point Racing\nEndurance Tool",
                          font=("Arial", 11), fg="#9ca3af", bg="#1a1d27")
        subtitle.pack()

        # Name input
        name_frame = tk.Frame(self.root, bg="#1a1d27")
        name_frame.pack(pady=(15, 5))

        tk.Label(name_frame, text="Your iRacing Name:",
                font=("Arial", 10), fg="#9ca3af", bg="#1a1d27").pack()

        self.name_var = tk.StringVar()
        self.name_entry = tk.Entry(name_frame, textvariable=self.name_var,
                                   font=("Arial", 12), width=25,
                                   bg="#252833", fg="white", insertbackground="white",
                                   relief="flat", highlightthickness=1,
                                   highlightcolor="#8b5cf6")
        self.name_entry.pack(pady=5, ipady=4)
        self.name_entry.focus()
        self.name_entry.bind("<Return>", lambda e: self.start())

        # Team selector
        team_frame = tk.Frame(self.root, bg="#1a1d27")
        team_frame.pack(pady=(5, 5))

        tk.Label(team_frame, text="Team:",
                font=("Arial", 10), fg="#9ca3af", bg="#1a1d27").pack()

        self.team_var = tk.StringVar(value="Team A")
        from tkinter import ttk
        style = ttk.Style()
        style.configure("Dark.TCombobox", fieldbackground="#252833", background="#252833")
        self.team_combo = ttk.Combobox(team_frame, textvariable=self.team_var,
                                        values=["Team A", "Team B", "Team C"],
                                        font=("Arial", 11), width=23)
        self.team_combo.pack(pady=5)

        # Connect button
        self.connect_btn = tk.Button(self.root, text="Connect",
                                     font=("Arial", 11, "bold"),
                                     bg="#22c55e", fg="white",
                                     activebackground="#16a34a",
                                     relief="flat", padx=20, pady=5,
                                     command=self.start)
        self.connect_btn.pack(pady=10)

        # Status
        self.status_var = tk.StringVar(value="Enter your name and click Connect")
        self.status_label = tk.Label(self.root, textvariable=self.status_var,
                                     font=("Arial", 9), fg="#6b7280", bg="#1a1d27")
        self.status_label.pack()

        self.running = False

    def start(self):
        name = self.name_var.get().strip()
        if not name:
            messagebox.showwarning("Name Required", "Please enter your iRacing name.")
            return

        team = self.team_var.get().strip() or "Team A"

        self.running = True
        self.connect_btn.configure(state="disabled", bg="#6b7280", text="Connecting...")
        self.name_entry.configure(state="disabled")
        self.team_combo.configure(state="disabled")
        self.status_var.set(f"Connecting to BPR server ({team})...")

        thread = threading.Thread(target=self._run_agent, args=(name, team), daemon=True)
        thread.start()

    def _run_agent(self, driver_name, team):
        asyncio.run(self._agent_loop(driver_name, team))

    async def _agent_loop(self, driver_name, team):
        import websockets
        import json
        import time
        from urllib.parse import quote

        # Build URL with team query param
        sep = '&' if '?' in SERVER_URL else '?'
        server_url = f"{SERVER_URL}{sep}team={quote(team)}"

        while self.running:
            try:
                self._update_status(f"Connecting to {team}...")
                async with websockets.connect(server_url) as ws:
                    self._update_status(f"Connected as {driver_name}")
                    self._update_button("Connected", "#22c55e")

                    # Check for iRacing
                    try:
                        import irsdk
                        ir = irsdk.IRSDK()
                        ir.startup()

                        if not ir.is_connected:
                            self._update_status("Waiting for iRacing to start...")
                            while not ir.is_connected and self.running:
                                ir.startup()
                                await asyncio.sleep(1)

                        if not self.running:
                            break

                        from capture import read_frame, get_driver_info, get_session_info
                        d_info = get_driver_info(ir)
                        s_info = get_session_info(ir)
                        actual_name = d_info["name"] if d_info["name"] != "Unknown" else driver_name
                        car = d_info["car"]
                        track_name = s_info["trackName"] if s_info else "Unknown"
                        track_id = s_info.get("trackId", 0) if s_info else 0

                        await ws.send(hello_message(actual_name, car, track_id, track_name))
                        self._update_status(f"Live: {actual_name} | {car} | {track_name}")

                        interval = 1.0 / SEND_RATE_HZ
                        while self.running:
                            start = time.time()
                            if not ir.is_connected:
                                self._update_status("iRacing disconnected. Waiting...")
                                break
                            frame = read_frame(ir)
                            await ws.send(frame_message(frame))
                            elapsed = time.time() - start
                            await asyncio.sleep(max(0, interval - elapsed))

                    except ImportError:
                        # pyirsdk not available - can't connect to iRacing
                        self._update_status("iRacing SDK not found. Install pyirsdk.")
                        await asyncio.sleep(5)

            except Exception as e:
                self._update_status(f"Disconnected. Retrying in 3s... ({e})")
                self._update_button("Reconnecting...", "#f59e0b")
                await asyncio.sleep(3)

    def _update_status(self, text):
        try:
            self.root.after(0, lambda: self.status_var.set(text))
        except Exception:
            pass

    def _update_button(self, text, color):
        try:
            self.root.after(0, lambda: self.connect_btn.configure(text=text, bg=color))
        except Exception:
            pass

    def run(self):
        self.root.mainloop()
        self.running = False


if __name__ == "__main__":
    app = AgentGUI()
    app.run()
