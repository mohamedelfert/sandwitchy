#!/bin/bash
set -e

echo ""
echo "  🥙  Sandwitchy — Local Setup"
echo ""

# Check node
if ! command -v node &> /dev/null; then
  echo "  ❌  Node.js مش موجود!"
  echo "  شغّل الأمر ده الأول:"
  echo ""
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -"
  echo "  sudo apt install -y nodejs"
  echo ""
  exit 1
fi

echo "  ✅  Node.js $(node -v) موجود"
echo ""

# Install deps
echo "  📦  جاري تثبيت الـ packages..."
npm install --silent

# Build frontend
echo "  🔨  جاري البناء..."
npx vite build

echo ""
echo "  ✅  تمام! بيشتغل دلوقتي..."
echo ""

# Run server
node server.js
