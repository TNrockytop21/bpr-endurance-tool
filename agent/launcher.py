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
        self.root.geometry("380x260")
        self.root.resizable(False, False)
        self.root.configure(bg="#1a1d27")

        # Try to keep on top initially
        self.root.attributes("-topmost", True)
        self.root.after(1000, lambda: self.root.attributes("-topmost", False))

        # Title
        title = tk.Label(self.root, text="BPR", font=("Arial", 24, "bold"),
                        fg="white", bg="#ef4444", padx=10, pady=2)
        title.pack(pady=(15, 5))

        subtitle = tk.Label(self.root, text="Bite Point Racing\nRace Control Agent",
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

        # Connect button
        self.connect_btn = tk.Button(self.root, text="Connect",
                                     font=("Arial", 11, "bold"),
                                     bg="#22c55e", fg="white",
                                     activebackground="#16a34a",
                                     relief="flat", padx=20, pady=5,
                                     command=self.start)
        self.connect_btn.pack(pady=10)

        # Protest button (hidden until connected)
        self.protest_btn = tk.Button(self.root, text="Report Incident (F1)",
                                     font=("Arial", 9, "bold"),
                                     bg="#ef4444", fg="white",
                                     activebackground="#dc2626",
                                     relief="flat", padx=12, pady=3,
                                     command=self._send_protest)
        # Don't pack yet — shown after connect

        # Status
        self.status_var = tk.StringVar(value="Enter your name and click Connect")
        self.status_label = tk.Label(self.root, textvariable=self.status_var,
                                     font=("Arial", 9), fg="#6b7280", bg="#1a1d27")
        self.status_label.pack()

        self.running = False
        self._ws = None  # current websocket for sending protests
        self._protest_cooldown = False

        # F1 hotkey for protest (global within this window)
        self.root.bind("<F1>", lambda e: self._send_protest())

    def start(self):
        name = self.name_var.get().strip()
        if not name:
            messagebox.showwarning("Name Required", "Please enter your iRacing name.")
            return

        self.running = True
        self.connect_btn.configure(state="disabled", bg="#6b7280", text="Connecting...")
        self.name_entry.configure(state="disabled")
        self.status_var.set("Connecting to BPR server...")

        thread = threading.Thread(target=self._run_agent, args=(name,), daemon=True)
        thread.start()

    def _run_agent(self, driver_name):
        asyncio.run(self._agent_loop(driver_name))

    async def _agent_loop(self, driver_name):
        import websockets
        import json
        import time

        while self.running:
            try:
                self._update_status("Connecting...")
                async with websockets.connect(SERVER_URL) as ws:
                    self._ws = ws
                    self._update_status(f"Connected as {driver_name}")
                    self._update_button("Connected", "#22c55e")
                    # Show the protest button
                    try:
                        self.root.after(0, lambda: self.protest_btn.pack(pady=(5, 0)))
                    except Exception:
                        pass

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

                        # Listen for server messages (penalties, race control)
                        listen_task = asyncio.create_task(self._listen_server(ws))

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

                        listen_task.cancel()

                    except ImportError:
                        # pyirsdk not available - can't connect to iRacing
                        self._update_status("iRacing SDK not found. Install pyirsdk.")
                        await asyncio.sleep(5)

            except Exception as e:
                self._update_status(f"Disconnected. Retrying in 3s... ({e})")
                self._update_button("Reconnecting...", "#f59e0b")
                await asyncio.sleep(3)

    async def _listen_server(self, ws):
        """Listen for incoming server messages (penalties, race control)."""
        import json
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                msg_type = msg.get("type", "")
                payload = msg.get("payload", {})

                if msg_type == "server:protestAck":
                    self._show_rc_message(payload)
                elif msg_type == "server:penalty":
                    self._show_penalty_notification(payload)
                elif msg_type == "server:underInvestigation":
                    self._show_investigation_notification(payload)
                elif msg_type == "server:message":
                    self._show_rc_message(payload)
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    def _show_penalty_notification(self, payload):
        """Show a transparent overlay notification over iRacing."""
        penalty_type = payload.get("type", "Unknown")
        time_sec = payload.get("timeSeconds")
        notes = payload.get("notes", "")

        labels = {
            "no-action": "NO ACTION",
            "race-incident": "RACE INCIDENT",
            "warning": "WARNING",
            "drive-through": "DRIVE-THROUGH PENALTY",
            "stop-go": "STOP & GO PENALTY",
            "time-penalty": f"TIME PENALTY — {time_sec}s" if time_sec else "TIME PENALTY",
            "dsq": "DISQUALIFIED",
        }
        display = labels.get(penalty_type, penalty_type.upper())

        colors = {
            "no-action": "#22c55e",
            "race-incident": "#3b82f6",
            "warning": "#f59e0b",
            "drive-through": "#ef4444",
            "stop-go": "#ef4444",
            "time-penalty": "#ef4444",
            "dsq": "#dc2626",
        }
        color = colors.get(penalty_type, "#ef4444")

        # Use a dark translucent color as the "transparent" background.
        # True per-pixel alpha requires platform-specific hacks; a dark
        # semi-opaque bar across the top of the screen is the cleanest
        # cross-platform approach and matches real motorsport overlays.
        overlay_bg = "#111111"

        def _show():
            overlay = tk.Toplevel(self.root)
            overlay.overrideredirect(True)
            overlay.attributes("-topmost", True)
            overlay.configure(bg=overlay_bg)

            # Try Windows-specific transparency (10 = very transparent)
            try:
                overlay.attributes("-alpha", 0.92)
            except Exception:
                pass

            # Position: top-center banner, full width, short height
            sw = overlay.winfo_screenwidth()
            bar_w = min(600, sw - 100)
            bar_h = 90 if not notes else 110
            x = (sw - bar_w) // 2
            y = 60  # Below iRacing's own top HUD
            overlay.geometry(f"{bar_w}x{bar_h}+{x}+{y}")

            # Accent stripe at top
            stripe = tk.Frame(overlay, bg=color, height=3)
            stripe.pack(fill="x")

            # "RACE CONTROL" header
            tk.Label(overlay, text="RACE CONTROL",
                     font=("Arial", 9, "bold"), fg="#888888",
                     bg=overlay_bg, anchor="center",
                     ).pack(pady=(8, 0))

            # Penalty text
            tk.Label(overlay, text=display,
                     font=("Arial", 20, "bold"), fg=color,
                     bg=overlay_bg, anchor="center",
                     ).pack(pady=(2, 0))

            # Notes
            if notes:
                tk.Label(overlay, text=notes,
                         font=("Arial", 10), fg="#999999",
                         bg=overlay_bg, anchor="center", wraplength=bar_w - 40,
                         ).pack(pady=(2, 0))

            # Fade out after 8 seconds
            def _fade_out(step=0):
                if not overlay.winfo_exists():
                    return
                total_steps = 20
                if step >= total_steps:
                    overlay.destroy()
                    return
                alpha = 0.92 * (1 - step / total_steps)
                try:
                    overlay.attributes("-alpha", max(0.0, alpha))
                except Exception:
                    overlay.destroy()
                    return
                overlay.after(50, lambda: _fade_out(step + 1))

            overlay.after(8000, _fade_out)

            # Click anywhere to dismiss
            overlay.bind("<Button-1>", lambda e: overlay.destroy())

        try:
            self.root.after(0, _show)
        except Exception:
            pass

    def _show_investigation_notification(self, payload):
        """Show an 'Incident Under Investigation' overlay."""
        notes = payload.get("notes", "")
        overlay_bg = "#111111"
        color = "#f59e0b"  # amber

        def _show():
            overlay = tk.Toplevel(self.root)
            overlay.overrideredirect(True)
            overlay.attributes("-topmost", True)
            overlay.configure(bg=overlay_bg)
            try:
                overlay.attributes("-alpha", 0.92)
            except Exception:
                pass

            sw = overlay.winfo_screenwidth()
            bar_w = min(600, sw - 100)
            bar_h = 90 if not notes else 110
            x = (sw - bar_w) // 2
            y = 60
            overlay.geometry(f"{bar_w}x{bar_h}+{x}+{y}")

            stripe = tk.Frame(overlay, bg=color, height=3)
            stripe.pack(fill="x")

            tk.Label(overlay, text="RACE CONTROL",
                     font=("Arial", 9, "bold"), fg="#888888",
                     bg=overlay_bg, anchor="center",
                     ).pack(pady=(8, 0))

            tk.Label(overlay, text="INCIDENT UNDER INVESTIGATION",
                     font=("Arial", 20, "bold"), fg=color,
                     bg=overlay_bg, anchor="center",
                     ).pack(pady=(2, 0))

            if notes:
                tk.Label(overlay, text=notes,
                         font=("Arial", 10), fg="#999999",
                         bg=overlay_bg, anchor="center", wraplength=bar_w - 40,
                         ).pack(pady=(2, 0))

            def _fade_out(step=0):
                if not overlay.winfo_exists():
                    return
                total_steps = 20
                if step >= total_steps:
                    overlay.destroy()
                    return
                alpha = 0.92 * (1 - step / total_steps)
                try:
                    overlay.attributes("-alpha", max(0.0, alpha))
                except Exception:
                    overlay.destroy()
                    return
                overlay.after(50, lambda: _fade_out(step + 1))

            overlay.after(10000, _fade_out)
            overlay.bind("<Button-1>", lambda e: overlay.destroy())

        try:
            self.root.after(0, _show)
        except Exception:
            pass

    def _send_protest(self):
        """Send a protest/incident report to race control."""
        import json
        if self._protest_cooldown:
            return
        if not self._ws:
            return

        try:
            import asyncio
            msg = json.dumps({
                "type": "agent:protest",
                "payload": {"reason": "Driver-reported incident"},
            })
            # Schedule the send on the event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(self._ws.send(msg), loop)
            else:
                # Fallback — shouldn't happen but safe
                pass
        except Exception:
            pass

        # Cooldown — prevent spam, 10 second lockout
        self._protest_cooldown = True
        self.protest_btn.configure(state="disabled", bg="#6b7280", text="Reported!")

        def _reset():
            self._protest_cooldown = False
            try:
                self.protest_btn.configure(state="normal", bg="#ef4444", text="Report Incident (F1)")
            except Exception:
                pass

        self.root.after(10000, _reset)

    def _show_rc_message(self, payload):
        """Show a race control message overlay (white text, neutral styling)."""
        message = payload.get("message", "")
        if not message:
            return
        overlay_bg = "#111111"
        color = "#ffffff"

        # Detect color from message content
        msg_lower = message.lower()
        if "red flag" in msg_lower or "closed" in msg_lower:
            color = "#ef4444"
        elif "yellow" in msg_lower or "safety car" in msg_lower or "caution" in msg_lower or "warning" in msg_lower:
            color = "#f59e0b"
        elif "green" in msg_lower or "open" in msg_lower or "resume" in msg_lower:
            color = "#22c55e"

        def _show():
            overlay = tk.Toplevel(self.root)
            overlay.overrideredirect(True)
            overlay.attributes("-topmost", True)
            overlay.configure(bg=overlay_bg)
            try:
                overlay.attributes("-alpha", 0.92)
            except Exception:
                pass

            sw = overlay.winfo_screenwidth()
            bar_w = min(600, sw - 100)
            bar_h = 75
            x = (sw - bar_w) // 2
            y = 60
            overlay.geometry(f"{bar_w}x{bar_h}+{x}+{y}")

            stripe = tk.Frame(overlay, bg=color, height=3)
            stripe.pack(fill="x")

            tk.Label(overlay, text="RACE CONTROL",
                     font=("Arial", 9, "bold"), fg="#888888",
                     bg=overlay_bg, anchor="center",
                     ).pack(pady=(8, 0))

            tk.Label(overlay, text=message,
                     font=("Arial", 16, "bold"), fg=color,
                     bg=overlay_bg, anchor="center", wraplength=bar_w - 40,
                     ).pack(pady=(2, 8))

            def _fade_out(step=0):
                if not overlay.winfo_exists():
                    return
                total_steps = 20
                if step >= total_steps:
                    overlay.destroy()
                    return
                alpha = 0.92 * (1 - step / total_steps)
                try:
                    overlay.attributes("-alpha", max(0.0, alpha))
                except Exception:
                    overlay.destroy()
                    return
                overlay.after(50, lambda: _fade_out(step + 1))

            overlay.after(10000, _fade_out)
            overlay.bind("<Button-1>", lambda e: overlay.destroy())

        try:
            self.root.after(0, _show)
        except Exception:
            pass

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
