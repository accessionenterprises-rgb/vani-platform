"""
Vaani local test server — generates tokens + dispatches agent.
Run: python test-server.py
Then open http://localhost:3456 in Chrome
"""
import asyncio
import json
import os
import random
import string
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import subprocess
import shutil
from dotenv import load_dotenv
from livekit import api

load_dotenv(Path(__file__).parent / "vani-engine/.env.local")

API_KEY    = os.environ["LIVEKIT_API_KEY"]
API_SECRET = os.environ["LIVEKIT_API_SECRET"]
LK_URL     = os.environ["LIVEKIT_URL"]
AGENT_NAME = "vani-agent"
LK_BIN     = shutil.which("lk") or str(Path.home() / "bin/lk")

def make_room_name():
    return "vani-test-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=6))

def generate_token(room_name, identity="user-test"):
    token = api.AccessToken(API_KEY, API_SECRET)
    token.with_identity(identity).with_name("Test User")
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    ))
    return token.to_jwt()

def dispatch_agent(room_name):
    result = subprocess.run([
        LK_BIN, "dispatch", "create",
        "--agent-name", AGENT_NAME,
        "--room", room_name,
        "--url", LK_URL,
        "--api-key", API_KEY,
        "--api-secret", API_SECRET,
    ], capture_output=True, text=True)
    print(f"Dispatch: {result.stdout.strip() or result.stderr.strip()}")

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/":
            html = Path(__file__).parent / "test.html"
            content = html.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        elif self.path == "/join":
            room_name = make_room_name()
            token = generate_token(room_name)
            dispatch_agent(room_name)
            payload = json.dumps({
                "token": token,
                "room": room_name,
                "url": LK_URL,
            }).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        print(f"  {args[0]} {args[1]}")

if __name__ == "__main__":
    server = HTTPServer(("localhost", 3456), Handler)
    print(f"\n  Vaani test server running at http://localhost:3456\n")
    server.serve_forever()
