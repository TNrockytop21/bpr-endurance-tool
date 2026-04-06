#!/bin/bash
# BPR Endurance Tool - Server Deployment Script
# Run this on your DigitalOcean droplet as root
# Usage: bash deploy.sh

set -e

echo "=== BPR Endurance Tool Deployment ==="
echo ""

# Install Node.js 20
echo "[1/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y nodejs git nginx ufw > /dev/null 2>&1
echo "  Node $(node --version), npm $(npm --version)"

# Install pm2
echo "[2/7] Installing pm2..."
npm install -g pm2 > /dev/null 2>&1

# Create app directory
echo "[3/7] Setting up application..."
mkdir -p /opt/bpr-telemetry
cd /opt/bpr-telemetry

# Check if code exists (uploaded via scp or git)
if [ ! -f "package.json" ]; then
  echo ""
  echo "ERROR: No code found in /opt/bpr-telemetry/"
  echo "Upload your code first with:"
  echo "  scp -r \"Telemetry App/*\" root@YOUR_IP:/opt/bpr-telemetry/"
  echo "Then run this script again."
  exit 1
fi

# Install dependencies
echo "[4/7] Installing npm dependencies..."
npm install > /dev/null 2>&1

# Build the frontend
echo "[5/7] Building frontend..."
cd apps/web
npx vite build > /dev/null 2>&1
cd /opt/bpr-telemetry

# Configure nginx
echo "[6/7] Configuring nginx..."
cat > /etc/nginx/sites-available/bpr-telemetry << 'NGINX'
server {
    listen 80;
    server_name _;

    # Serve the built frontend
    root /opt/bpr-telemetry/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy WebSocket connections to the Node.js server
    location /ws/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8080;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/bpr-telemetry /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t > /dev/null 2>&1
systemctl restart nginx

# Configure firewall
echo "[7/7] Configuring firewall..."
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw allow 8080/tcp > /dev/null 2>&1
echo "y" | ufw enable > /dev/null 2>&1

# Start the telemetry server with pm2
cd /opt/bpr-telemetry
pm2 delete bpr-server 2>/dev/null || true
pm2 start apps/server/src/main.js --name bpr-server
pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Dashboard:  http://$(curl -s ifconfig.me)"
echo "Agent URL:  ws://$(curl -s ifconfig.me)/ws/agent"
echo ""
echo "Drivers connect with:"
echo "  python main.py --server ws://$(curl -s ifconfig.me)/ws/agent --name \"Driver Name\""
echo ""
echo "To check server status: pm2 status"
echo "To view server logs:    pm2 logs bpr-server"
