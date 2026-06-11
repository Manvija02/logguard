#!/bin/bash
# LogGuard — Quick Start (Flask backend)
# Run this script to start the entire stack.

set -e

echo "============================================"
echo "  LogGuard — Flask Backend Edition"
echo "============================================"

# Option 1: Docker Compose (recommended)
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
  echo "[*] Starting with Docker Compose..."
  docker-compose up --build
  exit 0
fi

if command -v docker &> /dev/null && docker compose version &> /dev/null 2>&1; then
  echo "[*] Starting with Docker Compose (v2)..."
  docker compose up --build
  exit 0
fi

# Option 2: Local Python (no Docker)
echo "[*] Docker not found — starting backend locally with Python..."

cd "$(dirname "$0")/backend"
[ -f .env ] || { echo "ERROR: backend/.env missing. Copy .env.example first."; exit 1; }

# Create venv if needed
if [ ! -d "venv" ]; then
  echo "[*] Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate

echo "[*] Installing Python dependencies..."
pip install -q -r requirements.txt

echo "[*] Starting Flask backend on http://localhost:4000"
python app.py
