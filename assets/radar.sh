#!/bin/bash

# Configuration
RADAR_DOWNLOAD_URL="http://us-phx-3.xeh.sh:25000/assets/radar.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Log helper functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    error "Please run as root"
    exit 1
fi

# Function to install Node.js
install_nodejs() {
    log "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        log "Installing Node.js..."
        
        # Install necessary tools
        apt-get update
        apt-get install -y curl

        # Get Ubuntu version
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            if [ "$ID" = "ubuntu" ]; then
                # Install Node.js 20.x for Ubuntu
                curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                apt-get install -y nodejs
            else
                # For other distributions
                curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
                yum install -y nodejs
            fi
        else
            error "Unsupported operating system"
            exit 1
        fi
        
        log "Node.js installed successfully"
    else
        log "Node.js is already installed"
    fi

    # Install npm if not present
    if ! command -v npm &> /dev/null; then
        log "Installing npm..."
        apt-get install -y npm || yum install -y npm
    fi

    # Check versions
    log "Node.js version: $(node -v)"
    log "npm version: $(npm -v)"
}

# Function to install dependencies
install_dependencies() {
    log "Installing system dependencies..."
    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y curl wget git
    else
        yum install -y curl wget git
    fi
}

# Main upgrade process
log "Starting Radar installation/upgrade process..."

# Install dependencies
install_dependencies

# Install Node.js and npm if needed
install_nodejs

# Function to create radar CLI tool
create_radar_cli() {
    cat > /usr/local/bin/radar << EOL
#!/bin/bash
case "\$1" in
    status)
        systemctl status radar
        ;;
    logs)
        tail -f /var/log/radar.log
        ;;
    errors)
        tail -f /var/log/radar.error.log
        ;;
    restart)
        systemctl restart radar
        ;;
    stop)
        systemctl stop radar
        ;;
    start)
        systemctl start radar
        ;;
    *)
        echo "Usage: radar {status|logs|errors|restart|stop|start}"
        exit 1
        ;;
esac
EOL
    chmod +x /usr/local/bin/radar
    log "Created 'radar' CLI tool"
}

# Function to setup logging
setup_logging() {
    touch /var/log/radar.log /var/log/radar.error.log
    chmod 644 /var/log/radar.log /var/log/radar.error.log

    cat > /etc/logrotate.d/radar << EOL
/var/log/radar.log /var/log/radar.error.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOL
    log "Setup logging and log rotation"
}

# Function to create systemd service
create_systemd_service() {
    cat > /etc/systemd/system/radar.service << EOL
[Unit]
Description=Radar Container Monitoring
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/radar
ExecStart=/usr/bin/node radar.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/radar.log
StandardError=append:/var/log/radar.error.log

[Install]
WantedBy=multi-user.target
EOL

    systemctl daemon-reload
    log "Created systemd service"
}

# Check existing installations
if [ -f "/etc/g13/g13.js" ]; then
    log "Found Radar v4 installation - upgrading..."
    
    # Backup v4
    mkdir -p /opt/radar/backups
    cp "/etc/g13/g13.js" "/opt/radar/backups/g13.js.backup_$(date +%Y%m%d_%H%M%S)"
    
    # Stop v4
    log "Stopping Radar v4..."
    if command -v pm2 &> /dev/null; then
        pm2 stop g13 2>/dev/null || true
        pm2 delete g13 2>/dev/null || true
        pm2 save
    else
        warning "pm2 not found, skipping pm2 cleanup"
    fi

elif [ -f "/opt/radar/radar.js" ]; then
    log "Found existing Radar installation - updating..."
    systemctl stop radar

    # Backup existing installation
    mkdir -p /opt/radar/backups
    cp "/opt/radar/radar.js" "/opt/radar/backups/radar.js.backup_$(date +%Y%m%d_%H%M%S)"
else
    log "No existing installation found - performing fresh install..."
fi

# Create/update installation
mkdir -p /opt/radar
cd /opt/radar

# Create package.json with latest dependencies
cat > package.json << EOL
{
  "name": "radar",
  "version": "1.0.0",
  "type": "module",
  "main": "radar.js",
  "dependencies": {
    "express": "^4.18.2",
    "dockerode": "^4.0.0",
    "fs-extra": "^11.2.0",
    "axios": "^1.6.7",
    "timeago.js": "^4.0.2",
    "lru-cache": "^7.6.1"
  }
}
EOL

# Get latest radar code
log "Downloading latest Radar code..."
wget -O radar.js "$RADAR_DOWNLOAD_URL"

# Install dependencies
log "Installing Node.js dependencies..."
npm install

# Setup logging if not exists
setup_logging

# Create systemd service if not exists
if [ ! -f "/etc/systemd/system/radar.service" ]; then
    create_systemd_service
fi

# Create CLI tool if not exists
if [ ! -f "/usr/local/bin/radar" ]; then
    create_radar_cli
fi

# Start radar
log "Starting Radar..."
systemctl enable radar
systemctl restart radar

# Final checks
log "Running final checks..."

if systemctl is-active --quiet radar; then
    log "Radar is running successfully"
    log "You can use the 'radar' command to manage it:"
    log "  radar status  - Check status"
    log "  radar logs    - View logs"
    log "  radar errors  - View error logs"
    log "  radar restart - Restart the service"
else
    error "Radar failed to start. Check logs with: journalctl -u radar"
    exit 1
fi

log "Installation/upgrade complete!"