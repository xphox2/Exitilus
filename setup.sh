#!/bin/bash
# ============================================================================
# Exitilus Reborn - Ubuntu Server Setup Script
# Run this on a fresh Ubuntu server to get the game running
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/xphox2/Exitilus/master/setup.sh | bash
#   or:
#   chmod +x setup.sh && ./setup.sh
# ============================================================================

set -e

# Colors for output
RED='\033[1;31m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
NC='\033[0m'

echo -e "${YELLOW}"
echo "  ███████╗██╗  ██╗██╗████████╗██╗██╗     ██╗   ██╗███████╗"
echo "  ██╔════╝╚██╗██╔╝██║╚══██╔══╝██║██║     ██║   ██║██╔════╝"
echo "  █████╗   ╚███╔╝ ██║   ██║   ██║██║     ██║   ██║███████╗"
echo "  ██╔══╝   ██╔██╗ ██║   ██║   ██║██║     ██║   ██║╚════██║"
echo "  ███████╗██╔╝ ██╗██║   ██║   ██║███████╗╚██████╔╝███████║"
echo "  ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝╚══════╝ ╚═════╝ ╚══════╝"
echo -e "${CYAN}                    R E B O R N${NC}"
echo ""
echo -e "${GREEN}  Ubuntu Server Setup Script${NC}"
echo ""

# ── Check if running as root ──
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Don't run this as root. Run as a regular user with sudo access.${NC}"
    exit 1
fi

# ── Configuration ──
INSTALL_DIR="/opt/Exitilus"
WEB_PORT=8080
SERVICE_USER="$USER"

echo -e "${CYAN}Configuration:${NC}"
echo "  Install directory: $INSTALL_DIR"
echo "  Web port: $WEB_PORT"
echo "  Service user: $SERVICE_USER"
echo ""

read -p "Press Enter to continue (Ctrl+C to cancel)..."
echo ""

# ── Step 1: System packages ──
echo -e "${GREEN}[1/7] Installing system dependencies...${NC}"
sudo apt update -qq
sudo apt install -y -qq curl git build-essential > /dev/null 2>&1
echo "  Done."

# ── Step 2: Node.js ──
echo -e "${GREEN}[2/7] Installing Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    echo "  Node.js already installed: $NODE_VER"
    # Check version is 20+
    NODE_MAJOR=$(echo $NODE_VER | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo "  Version too old, upgrading..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - > /dev/null 2>&1
        sudo apt install -y -qq nodejs > /dev/null 2>&1
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - > /dev/null 2>&1
    sudo apt install -y -qq nodejs > /dev/null 2>&1
fi
echo "  Node.js: $(node -v), npm: $(npm -v)"

# ── Step 3: Clone or update repo ──
echo -e "${GREEN}[3/7] Getting Exitilus source code...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo "  Directory exists, pulling latest..."
    cd "$INSTALL_DIR"
    git pull
else
    sudo git clone https://github.com/xphox2/Exitilus.git "$INSTALL_DIR"
    sudo chown -R $SERVICE_USER:$SERVICE_USER "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
echo "  Done."

# ── Step 4: Install dependencies ──
echo -e "${GREEN}[4/7] Installing npm dependencies...${NC}"
cd "$INSTALL_DIR"
npm install --production=false 2>&1 | tail -1
echo "  Done."

# ── Step 5: Build ──
echo -e "${GREEN}[5/7] Building TypeScript...${NC}"
npm run build 2>&1 | tail -1
echo "  Done."

# ── Step 6: Create systemd service ──
echo -e "${GREEN}[6/7] Creating systemd service...${NC}"
sudo tee /etc/systemd/system/exitilus.service > /dev/null << EOF
[Unit]
Description=Exitilus Reborn - Fantasy BBS Door Game
After=network.target
Documentation=https://github.com/xphox2/Exitilus

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) dist/index.js --web $WEB_PORT
Restart=always
RestartSec=5
Environment=NODE_ENV=production

# Security hardening
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable exitilus > /dev/null 2>&1
echo "  Service created and enabled."

# ── Step 7: Start the game ──
echo -e "${GREEN}[7/7] Starting Exitilus...${NC}"
sudo systemctl start exitilus
sleep 2

# Check if it's running
if sudo systemctl is-active --quiet exitilus; then
    echo -e "  ${GREEN}Exitilus is running!${NC}"
else
    echo -e "  ${RED}Failed to start. Check: sudo journalctl -u exitilus -f${NC}"
    exit 1
fi

# ── Get server IP ──
SERVER_IP=$(hostname -I | awk '{print $1}')

# ── Done! ──
echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║${GREEN}              Exitilus Reborn is LIVE!                    ${YELLOW}║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Play in browser:${NC}  http://${SERVER_IP}:${WEB_PORT}"
echo -e "  ${CYAN}Play via telnet:${NC}  (add --telnet 2323 to service for telnet)"
echo ""
echo -e "  ${CYAN}Manage the service:${NC}"
echo "    sudo systemctl status exitilus    # Check status"
echo "    sudo systemctl restart exitilus   # Restart"
echo "    sudo systemctl stop exitilus      # Stop"
echo "    sudo journalctl -u exitilus -f    # View logs"
echo ""
echo -e "  ${CYAN}Admin tools:${NC}"
echo "    cd $INSTALL_DIR"
echo "    npx tsx src/tools/admin.ts        # Interactive admin"
echo "    npx tsx src/tools/admin.ts list   # List players"
echo ""
echo -e "  ${CYAN}Update to latest:${NC}"
echo "    cd $INSTALL_DIR && git pull && npm install && npm run build"
echo "    sudo systemctl restart exitilus"
echo ""
echo -e "  ${CYAN}Optional: Nginx reverse proxy for port 80/HTTPS:${NC}"
echo "    sudo apt install nginx"
echo "    See README for nginx config"
echo ""
echo -e "${GREEN}Enjoy the game!${NC}"
