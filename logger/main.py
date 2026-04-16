import time
import requests
import psutil
from datetime import datetime

try:
    import win32gui
    import win32process
    USE_WIN32 = True
except ImportError:
    USE_WIN32 = False

BACKEND_URL = "http://localhost:8080/api/logs"
INTERVAL = 30  # seconds

def get_active_window():
    try:
        if USE_WIN32:
            hwnd = win32gui.GetForegroundWindow()
            title = win32gui.GetWindowText(hwnd)
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process = psutil.Process(pid)
            return process.name(), title
        else:
            return "Unknown", "Unknown"
    except Exception as e:
        return "Unknown", str(e)

def post_log(app_name, window_title):
    payload = {
        "appName": app_name,
        "windowTitle": window_title,
        "timestamp": datetime.now().isoformat()
    }
    try:
        r = requests.post(BACKEND_URL, json=payload)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Logged: {app_name} → {r.status_code}")
    except Exception as e:
        print(f"Error posting log: {e}")

if __name__ == "__main__":
    print("TimeScope logger started. Logging every 30s...")
    while True:
        app, title = get_active_window()
        post_log(app, title)
        time.sleep(INTERVAL)