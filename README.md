# Heliactyl Next

The all-in-one dashboard built from the legacy of Heliactyl. A high performance user interface, full built-in panel for managing servers, coins system, resources store and more.

## Required: Edit your Wings configuration

**Before deploying Heliactyl Next, you must configure each node's Wings configuration!**

1. On each node, edit the Wings configuration file (usually at `/etc/pterodactyl/config.yml`)
2. Locate the `allowed-origins` section
3. Change:
   ```yaml
   allowed-origins: []
   ```
   to either:
   ```yaml
   allowed-origins: ['*']  # recommended for simplicity
   ```
   or:
   ```yaml
   allowed-origins: ['https://your-dashboard-domain.com']  # more restrictive option
   ```

If you don't do this, Heliactyl Next can't communicate with your nodes.

## Features

- Modern, responsive user interface
- Built-in panel, goodbye Pterodactyl
- Integrated coins/credits system
- User/password authentication
- Resource allocation system
- Real-time stats and charts
- Support tickets *(pending reimplementation)*
- Admin area with users, nodes and more

## Prerequisites

- Bun v1.1.42 or higher
- Node.js v18+ *(for frontend only, backend runs on Bun)*
- Redis
- Nginx
- SSL certificate (recommended)

## 1. Prerequisites Installation

1. Install Redis:
```bash
# For Ubuntu/Debian
sudo apt update
sudo apt install redis-server

# For CentOS/RHEL
sudo dnf install epel-release
sudo dnf install redis

# Start and enable Redis
sudo systemctl start redis
sudo systemctl enable redis
```

2. Install Bun:
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Node.js
# This depends on your system, find how to via https://nodejs.org

# Upgrade to Bun Canary (important!)
bun upgrade --canary

# Reload shell configuration to use Bun
source ~/.bashrc
```

## 2. Heliactyl Next Installation

1. Clone the repository:
```bash
git clone https://github.com/Heliactyl NextFOSS/Heliactyl Next
cd Heliactyl Next
```

2. Install dependencies:
```bash
bun install
```

3. Create configuration file:
```bash
cp example_config.toml config.toml
```

4. Configure your `config.toml` file

5. Build & Start Heliactyl Next:
```bash
cd app
npm install
npm run build
cd ../

bun run app.js
```

## Nginx Configuration 

This is required to host Heliactyl Next on a public URL.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dashboard.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name dashboard.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS (uncomment if you're using HTTPS)
    # add_header Strict-Transport-Security "max-age=63072000" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific settings
        proxy_read_timeout 86400;    # Prevents timeout for long-lived connections
        proxy_send_timeout 86400;    # Prevents timeout for long-lived connections
        proxy_buffering off;         # Disable buffering for real-time communication
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Optimize SSL
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
}
```

## License

This project is licensed under the Heliactyl Next Public Use License - see the LICENSE file for details.

## Support

For support, please open an issue on the GitHub repository or join our Discord community.

## Security

To report security vulnerabilities, please email security@xeh.sh
