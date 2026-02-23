# SSL/TLS Setup Guide

This guide explains how to configure SSL/TLS for your Ultralytics deployment.

## Prerequisites

- A valid SSL certificate and private key
- Domain name pointing to your server
- Docker and Docker Compose installed

## Option 1: Using Your Own Certificates

### Step 1: Obtain SSL Certificates

You can obtain SSL certificates from:
- **Let's Encrypt** (free, automated)
- **Commercial CA** (DigiCert, Comodo, etc.)
- **Self-signed** (for development only)

### Step 2: Place Certificates

Create an `ssl` directory in your project root and place your certificates:

```bash
mkdir -p ssl
cp /path/to/your/certificate.pem ssl/cert.pem
cp /path/to/your/private-key.pem ssl/key.pem
chmod 600 ssl/key.pem
```

### Step 3: Update Docker Compose

Edit `docker-compose.prod.yml` and update the nginx volumes:

```yaml
nginx:
  volumes:
    - ./nginx/nginx.ssl.conf:/etc/nginx/nginx.conf:ro
    - ./ssl/cert.pem:/etc/nginx/ssl/cert.pem:ro
    - ./ssl/key.pem:/etc/nginx/ssl/key.pem:ro
```

### Step 4: Set Environment Variables

Update your `.env` file:

```bash
PORT=80
SSL_PORT=443
```

### Step 5: Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Option 2: Using Let's Encrypt with Certbot

### Step 1: Install Certbot

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install certbot

# macOS
brew install certbot
```

### Step 2: Obtain Certificate

```bash
# Stop nginx temporarily if running
docker-compose -f docker-compose.prod.yml stop nginx

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com

# Certificate will be saved to /etc/letsencrypt/live/yourdomain.com/
```

### Step 3: Copy Certificates

```bash
mkdir -p ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*.pem
chmod 600 ssl/key.pem
```

### Step 4: Set Up Auto-Renewal

Add a cron job for automatic certificate renewal:

```bash
# Edit crontab
crontab -e

# Add this line (runs twice daily)
0 0,12 * * * certbot renew --quiet && docker-compose -f /path/to/docker-compose.prod.yml restart nginx
```

## Option 3: Self-Signed Certificates (Development Only)

**Warning:** Self-signed certificates will show browser warnings and should only be used for development/testing.

```bash
mkdir -p ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

## Verifying SSL Configuration

### Test HTTPS Connection

```bash
curl -v https://yourdomain.com/health
```

### Check Certificate Details

```bash
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### Online SSL Test

Use [SSL Labs](https://www.ssllabs.com/ssltest/) to test your configuration.

## Troubleshooting

### Certificate Permission Errors

```bash
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem
```

### Nginx Won't Start

Check nginx configuration:

```bash
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Port Already in Use

```bash
# Find what's using port 443
sudo lsof -i :443

# Or change the SSL_PORT in .env
SSL_PORT=8443
```

## Security Best Practices

1. **Use TLS 1.2 or higher** - Our nginx.ssl.conf is configured for TLS 1.2+
2. **Enable HSTS** - Uncomment the HSTS header in nginx.ssl.conf after confirming SSL works
3. **Redirect HTTP to HTTPS** - Already configured in nginx.ssl.conf
4. **Keep certificates updated** - Set up auto-renewal
5. **Secure private keys** - Restrict file permissions to 600
