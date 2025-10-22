#!/bin/bash
# ============================================
# SETUP SSL CERTIFICATE FOR HOSTINGER VPS
# Run this on VPS after DNS is configured
# ============================================

DOMAIN="ttshoptool.fun"
EMAIL="seringuyen0506@gmail.com"

echo ""
echo "================================================"
echo "  SSL CERTIFICATE SETUP"
echo "  Domain: $DOMAIN"
echo "================================================"
echo ""

# Check if DNS is configured
echo "Checking DNS configuration..."
DNS_IP=$(dig +short $DOMAIN | tail -1)
SERVER_IP=$(curl -s ifconfig.me)

if [ "$DNS_IP" != "$SERVER_IP" ]; then
    echo ""
    echo "WARNING: DNS not configured correctly!" >&2
    echo "Domain $DOMAIN points to: $DNS_IP" >&2
    echo "Server IP is: $SERVER_IP" >&2
    echo ""
    echo "Please configure DNS in Hostinger hPanel first:" >&2
    echo "1. Login: https://hpanel.hostinger.com" >&2
    echo "2. Go to: Domains -> $DOMAIN -> DNS Zone" >&2
    echo "3. Add A Record: @ -> $SERVER_IP" >&2
    echo "4. Add A Record: www -> $SERVER_IP" >&2
    echo "5. Wait 5-30 minutes for propagation" >&2
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install SSL certificate
echo ""
echo "Installing SSL certificate..."
echo ""

certbot --nginx \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --non-interactive \
    --redirect

# Test auto-renewal
echo ""
echo "Testing certificate auto-renewal..."
certbot renew --dry-run

# Show certificate info
echo ""
echo "================================================"
echo "  SSL CERTIFICATE INSTALLED!"
echo "================================================"
echo ""
echo "Website is now available at:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo "Certificate will auto-renew before expiration."
echo ""
echo "To manually renew:"
echo "  certbot renew"
echo ""
