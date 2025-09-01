---
title: Kuma
date: 2025-07-10
author: Christian / Nergy101
tags: [monitoring, uptime, kuma, self-hosted, docker]
---

# Kuma - Modern Uptime Monitoring

Kuma is a modern, open-source uptime monitoring service that provides comprehensive monitoring capabilities for websites, APIs, and other services. It's designed to be self-hosted, giving you complete control over your monitoring infrastructure.

**🔗 Live Status Page**: [https://kuma.nergy.space/status/all](https://kuma.nergy.space/status/all)

## What is Kuma?

Kuma is a powerful uptime monitoring solution that allows you to monitor the availability and performance of your services. It provides real-time alerts, detailed status pages, and comprehensive reporting features.

### Key Features

- **Real-time Monitoring**: Monitor HTTP/HTTPS endpoints, TCP ports, DNS queries, and more
- **Status Pages**: Create beautiful, customizable status pages for your services
- **Multi-location Monitoring**: Monitor from multiple geographic locations
- **Alerting**: Get notified via email, Discord, Slack, Telegram, and many other channels
- **Dashboard**: Clean, modern web interface for managing your monitors
- **API**: RESTful API for integration with other tools
- **Docker Support**: Easy deployment with Docker and Docker Compose

## Installation

### Using Docker Compose (Recommended)

The easiest way to get started with Kuma is using Docker Compose:

```yaml
version: '3.3'

services:
  kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    volumes:
      - ./kuma-data:/app/data
    ports:
      - '3001:3001'
    environment:
      - UPTIME_KUMA_PORT=3001
    restart: unless-stopped
    healthcheck:
      test:
        [
          'CMD',
          'wget',
          '--no-verbose',
          '--tries=1',
          '--spider',
          'http://localhost:3001/api/health',
        ]
      interval: 30s
      timeout: 10s
      retries: 3
```

Save this as `docker-compose.yml` and run:

```bash
docker-compose up -d
```

### Manual Installation

For manual installation, you can use Node.js:

```bash
# Clone the repository
git clone https://github.com/louislam/uptime-kuma.git
cd uptime-kuma

# Install dependencies
npm ci --production

# Start the application
npm start
```

## Configuration

### Initial Setup

1. **Access the Web Interface**: Navigate to `http://localhost:3001`
2. **Create Admin Account**: Set up your first admin user
3. **Add Monitors**: Start adding your first monitoring targets

### Environment Variables

Kuma supports various environment variables for configuration:

```bash
# Database
UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN=false
UPTIME_KUMA_DISABLE_2FA_OTP=false

# Security
UPTIME_KUMA_DISABLE_2FA_OTP=false
UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN=false

# Performance
UPTIME_KUMA_DISABLE_GZIP=false
UPTIME_KUMA_DISABLE_2FA_OTP=false
```

## Monitor Types

Kuma supports various types of monitoring:

### HTTP(s) Monitor

Monitor web applications and APIs:

- **URL**: The endpoint to monitor
- **Method**: GET, POST, PUT, etc.
- **Headers**: Custom headers for authentication
- **Body**: Request body for POST requests
- **Expected Status**: Expected HTTP status codes

### TCP Port Monitor

Monitor TCP services:

- **Host**: Server hostname or IP
- **Port**: TCP port number
- **Timeout**: Connection timeout in seconds

### DNS Monitor

Monitor DNS resolution:

- **Hostname**: Domain to resolve
- **Resolver**: DNS server to use
- **Record Type**: A, AAAA, MX, etc.

### Docker Container Monitor

Monitor Docker containers:

- **Container Name**: Name of the container
- **Docker Host**: Docker daemon endpoint

### Database Monitor

Monitor database connections:

- **Type**: MySQL, PostgreSQL, MongoDB, etc.
- **Host**: Database host
- **Port**: Database port
- **Database**: Database name
- **Username/Password**: Authentication credentials

## Alerting

### Notification Channels

Kuma supports many notification channels:

- **Email**: SMTP-based email notifications
- **Discord**: Discord webhook integration
- **Slack**: Slack webhook integration
- **Telegram**: Telegram bot notifications
- **Webhook**: Custom HTTP webhooks
- **Pushover**: Pushover notifications
- **Gotify**: Gotify server notifications
- **Line**: Line messaging
- **Matrix**: Matrix chat notifications
- **Signal**: Signal messaging

### Alert Configuration

Configure alerts with:

- **Notification Delay**: Delay before sending alerts
- **Retry**: Number of retry attempts
- **Escalation**: Escalation rules for persistent issues
- **Maintenance Windows**: Scheduled maintenance periods

## Status Pages

### Creating Status Pages

1. **Navigate to Status Page**: Go to Settings → Status Page
2. **Create New Page**: Click "Add Status Page"
3. **Configure Settings**:
   - **Title**: Page title
   - **Description**: Page description
   - **Domain**: Custom domain (optional)
   - **Logo**: Upload custom logo
   - **Theme**: Choose color scheme

### Customization

Status pages can be customized with:

- **Custom CSS**: Add custom styling
- **Custom JavaScript**: Add interactive features
- **Custom Domain**: Use your own domain
- **Analytics**: Google Analytics integration

## API Integration

Kuma provides a RESTful API for integration:

```bash
# Get all monitors
curl -X GET "http://localhost:3001/api/monitor" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Add a new monitor
curl -X POST "http://localhost:3001/api/monitor" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "name": "My Website",
    "type": "http",
    "url": "https://example.com",
    "interval": 60
  }'
```

## Best Practices

### Monitor Configuration

1. **Reasonable Intervals**: Don't check too frequently (minimum 30 seconds)
2. **Multiple Locations**: Use different monitoring locations
3. **Realistic Timeouts**: Set appropriate timeout values
4. **Expected Status Codes**: Specify expected HTTP status codes

### Alert Management

1. **Avoid Alert Fatigue**: Use appropriate notification delays
2. **Escalation Rules**: Set up escalation for critical services
3. **Maintenance Windows**: Schedule maintenance periods
4. **Group Notifications**: Group related monitors

### Performance Optimization

1. **Database Maintenance**: Regular database cleanup
2. **Monitor Limits**: Don't create too many monitors
3. **Resource Monitoring**: Monitor Kuma itself
4. **Backup Strategy**: Regular backups of Kuma data

## Troubleshooting

### Common Issues

**High CPU Usage**

- Check monitor intervals
- Reduce number of concurrent monitors
- Optimize database queries

**Memory Issues**

- Increase container memory limits
- Check for memory leaks
- Monitor resource usage

**Database Issues**

- Check database connectivity
- Verify database permissions
- Monitor database performance

### Logs

Access Kuma logs:

```bash
# Docker logs
docker logs uptime-kuma

# Application logs
tail -f /app/data/logs/app.log
```

## Security Considerations

### Access Control

1. **Strong Passwords**: Use strong admin passwords
2. **2FA**: Enable two-factor authentication
3. **API Keys**: Secure API key management
4. **Network Security**: Restrict access to Kuma interface

### Data Protection

1. **Encryption**: Use HTTPS for web interface
2. **Backup Encryption**: Encrypt backup data
3. **Access Logs**: Monitor access logs
4. **Regular Updates**: Keep Kuma updated

## Conclusion

Kuma is an excellent choice for self-hosted uptime monitoring. It provides all the features you need for comprehensive service monitoring while maintaining full control over your data and infrastructure.

Whether you're monitoring a small personal website or a large enterprise infrastructure, Kuma scales well and provides the tools you need to ensure your services are always available.

### Resources

- **Official Documentation**: [https://github.com/louislam/uptime-kuma](https://github.com/louislam/uptime-kuma)
- **Docker Hub**: [https://hub.docker.com/r/louislam/uptime-kuma](https://hub.docker.com/r/louislam/uptime-kuma)
- **Community**: [GitHub Discussions](https://github.com/louislam/uptime-kuma/discussions)
- **Issues**: [GitHub Issues](https://github.com/louislam/uptime-kuma/issues)

---

_This guide covers the basics of setting up and using Kuma for uptime monitoring. For more advanced features and configurations, refer to the official documentation._
