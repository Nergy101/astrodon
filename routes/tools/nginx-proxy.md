---
title: Nginx Proxy Manager
date: 2025-07-10
author: Christian / Nergy101
tags: [nginx, proxy, reverse-proxy, docker, web-server, ssl, lets-encrypt]
---

# Nginx Proxy Manager - Web Server Management

Nginx Proxy Manager is a beautiful, secure, and easy-to-use web-based interface for managing Nginx proxy hosts, SSL certificates, and more. It's designed to make managing reverse proxies and SSL certificates as simple as possible.

## What is Nginx Proxy Manager?

Nginx Proxy Manager is a web-based GUI for managing Nginx reverse proxies. It provides an intuitive interface for creating proxy hosts, managing SSL certificates, and configuring web server settings without needing to manually edit Nginx configuration files.

### Key Features

- **Web-based Interface**: Beautiful, responsive web UI for easy management
- **SSL Certificate Management**: Automatic Let's Encrypt SSL certificate generation and renewal
- **Reverse Proxy**: Easy setup of proxy hosts for multiple services
- **Stream Support**: TCP/UDP stream proxy support
- **Access Lists**: IP-based access control and authentication
- **Redirection Hosts**: URL redirection and forwarding
- **404 Hosts**: Custom 404 error pages
- **Docker Integration**: Easy deployment with Docker Compose
- **Database Backend**: SQLite or MySQL/MariaDB support

## Installation

### Using Docker Compose (Recommended)

The easiest way to get started with Nginx Proxy Manager is using Docker Compose:

```yaml
version: '3.8'

services:
  app:
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      - '80:80' # HTTP
      - '81:81' # Admin Web Interface
      - '443:443' # HTTPS
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    environment:
      - DB_MYSQL_HOST=db
      - DB_MYSQL_PORT=3306
      - DB_MYSQL_USER=npm
      - DB_MYSQL_PASSWORD=npm
      - DB_MYSQL_NAME=npm

  db:
    image: 'jc21/mariadb-aria:latest'
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=npm
      - MYSQL_DATABASE=npm
      - MYSQL_USER=npm
      - MYSQL_PASSWORD=npm
    volumes:
      - ./data/mysql:/var/lib/mysql
```

Save this as `docker-compose.yml` and run:

```bash
docker-compose up -d
```

### Initial Setup

1. **Access the Admin Interface**: Navigate to `http://your-server-ip:81`
2. **Default Credentials**:
   - Email: `admin@example.com`
   - Password: `changeme`
3. **Change Default Password**: Immediately change the default password
4. **Configure SSL**: Set up your domain and SSL certificates

## Configuration

### Proxy Hosts

Proxy hosts allow you to forward requests from one domain to another service:

1. **Navigate to Proxy Hosts**: Go to Hosts → Proxy Hosts
2. **Add Proxy Host**: Click "Add Proxy Host"
3. **Configure Settings**:
   - **Domain Names**: Your domain (e.g., `app.example.com`)
   - **Scheme**: HTTP or HTTPS
   - **Forward Hostname/IP**: Target service IP/hostname
   - **Forward Port**: Target service port
   - **Block Common Exploits**: Enable security features
   - **Websockets Support**: Enable for WebSocket applications

### SSL Certificates

Nginx Proxy Manager supports automatic SSL certificate management:

#### Let's Encrypt (Recommended)

1. **Enable SSL**: Check "Force SSL" and "HTTP/2 Support"
2. **Let's Encrypt**: Select "Request a new SSL Certificate"
3. **Email**: Enter your email for certificate notifications
4. **Agree to Terms**: Accept Let's Encrypt terms of service
5. **Save**: The certificate will be automatically generated

#### Custom SSL Certificates

For custom certificates:

1. **Upload Certificate**: Paste your certificate and private key
2. **Certificate Chain**: Include intermediate certificates if needed
3. **Save**: Apply the custom certificate

### Access Lists

Control access to your proxy hosts:

1. **Create Access List**: Go to Access Lists → Add Access List
2. **Configure Rules**:
   - **Name**: Descriptive name for the access list
   - **Satisfy**: Any (any rule matches) or All (all rules must match)
   - **Rules**: IP addresses, ranges, or authentication

#### Authentication

Set up basic authentication:

1. **Enable Authentication**: Check "Enable Authentication"
2. **Add Users**: Create username/password combinations
3. **Apply to Hosts**: Assign access lists to proxy hosts

## Common Use Cases

### Single Page Application (SPA)

For React, Vue, or Angular applications:

```nginx
# Nginx Proxy Manager automatically generates this configuration
location / {
    try_files $uri $uri/ /index.html;
}
```

### API Proxy

Forward API requests to backend services:

- **Domain**: `api.example.com`
- **Forward**: `http://backend-service:3000`
- **Path**: `/api`

### Load Balancing

Distribute traffic across multiple servers:

1. **Create Multiple Proxy Hosts**: Point to different backend servers
2. **Use DNS Round Robin**: Configure DNS to distribute requests
3. **Health Checks**: Monitor backend service health

### WebSocket Support

For real-time applications:

1. **Enable WebSockets**: Check "Websockets Support"
2. **Configure Headers**: Add necessary WebSocket headers
3. **Test Connection**: Verify WebSocket functionality

## Advanced Configuration

### Custom Nginx Configuration

Add custom Nginx directives:

1. **Advanced Tab**: Go to the Advanced tab in proxy host settings
2. **Custom Locations**: Add custom location blocks
3. **Custom Config**: Add custom Nginx directives

Example custom configuration:

```nginx
# Custom headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
```

### Stream Proxy

For TCP/UDP services:

1. **Navigate to Streams**: Go to Hosts → Streams
2. **Add Stream**: Configure TCP/UDP forwarding
3. **Port Mapping**: Map external ports to internal services

### Redirection Hosts

Set up URL redirections:

1. **Add Redirection Host**: Go to Hosts → Redirection Hosts
2. **Configure Settings**:
   - **Domain**: Source domain
   - **Scheme**: HTTP or HTTPS
   - **Forward Hostname/IP**: Target domain
   - **Forward Port**: Target port (usually 80 or 443)
   - **Preserve Path**: Keep original URL path

## Security Best Practices

### SSL/TLS Configuration

1. **Force HTTPS**: Always redirect HTTP to HTTPS
2. **Modern SSL**: Use TLS 1.2+ and strong ciphers
3. **HSTS**: Enable HTTP Strict Transport Security
4. **Certificate Renewal**: Monitor certificate expiration

### Access Control

1. **IP Whitelisting**: Restrict access to specific IP ranges
2. **Authentication**: Use basic auth for sensitive services
3. **Rate Limiting**: Implement rate limiting for APIs
4. **Security Headers**: Add security headers to responses

### Network Security

1. **Firewall Rules**: Configure firewall to allow only necessary ports
2. **VLAN Segregation**: Separate proxy from backend services
3. **Monitoring**: Monitor access logs and traffic patterns
4. **Backup Strategy**: Regular backups of configuration and certificates

## Monitoring and Logs

### Access Logs

View access logs in the web interface:

1. **Logs Tab**: Go to the Logs tab in proxy host settings
2. **Real-time Logs**: View live access logs
3. **Log Analysis**: Analyze traffic patterns and errors

### Error Monitoring

Monitor for common issues:

- **SSL Certificate Errors**: Check certificate validity
- **Backend Connection Errors**: Monitor backend service health
- **Rate Limiting**: Monitor rate limit violations
- **Authentication Failures**: Track failed login attempts

## Troubleshooting

### Common Issues

**SSL Certificate Problems**

- Check domain DNS resolution
- Verify Let's Encrypt rate limits
- Ensure port 80/443 is accessible
- Check certificate renewal logs

**Backend Connection Issues**

- Verify backend service is running
- Check network connectivity
- Validate port configuration
- Test direct backend access

**Performance Issues**

- Monitor resource usage
- Check Nginx worker processes
- Optimize SSL configuration
- Review access logs for bottlenecks

### Debug Mode

Enable debug logging:

1. **Environment Variables**: Add `DEBUG=true` to docker-compose
2. **Log Level**: Set Nginx log level to debug
3. **Container Logs**: Check Docker container logs

## Backup and Recovery

### Configuration Backup

Backup your configuration:

```bash
# Backup data directory
tar -czf npm-backup-$(date +%Y%m%d).tar.gz ./data

# Backup SSL certificates
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz ./letsencrypt
```

### Database Backup

Backup the database:

```bash
# MySQL backup
docker exec nginx-proxy-manager-db-1 mysqldump -u npm -p npm > npm-db-backup.sql

# SQLite backup (if using SQLite)
cp ./data/database.sqlite ./data/database.sqlite.backup
```

### Restore Process

Restore from backup:

1. **Stop Services**: Stop Nginx Proxy Manager
2. **Restore Data**: Extract backup files
3. **Restore Database**: Import database backup
4. **Start Services**: Restart containers
5. **Verify Configuration**: Check all proxy hosts

## Performance Optimization

### Nginx Tuning

Optimize Nginx performance:

```nginx
# Worker processes
worker_processes auto;

# Connection limits
worker_connections 1024;

# Buffer sizes
client_body_buffer_size 128k;
client_header_buffer_size 1k;
```

### SSL Optimization

Optimize SSL performance:

```nginx
# SSL session cache
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
```

### Caching

Implement caching strategies:

1. **Static Content**: Cache static assets
2. **Proxy Cache**: Cache backend responses
3. **Browser Cache**: Set appropriate cache headers

## Conclusion

Nginx Proxy Manager provides an excellent solution for managing reverse proxies and SSL certificates with a user-friendly interface. It's particularly well-suited for Docker environments and makes SSL certificate management much easier than manual configuration.

Whether you're running a single application or managing multiple services, Nginx Proxy Manager can help you set up secure, high-performance proxy configurations with minimal effort.

### Resources

- **Official Repository**: [https://github.com/jc21/nginx-proxy-manager](https://github.com/jc21/nginx-proxy-manager)
- **Docker Hub**: [https://hub.docker.com/r/jc21/nginx-proxy-manager](https://hub.docker.com/r/jc21/nginx-proxy-manager)
- **Documentation**: [https://nginx-proxy-manager.com/](https://nginx-proxy-manager.com/)
- **Community**: [GitHub Discussions](https://github.com/jc21/nginx-proxy-manager/discussions)

---

_This guide covers the essential aspects of setting up and using Nginx Proxy Manager. For advanced configurations and troubleshooting, refer to the official documentation and community resources._
