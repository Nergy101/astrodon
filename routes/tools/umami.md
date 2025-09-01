---
title: Umami
date: 2025-07-10
author: Christian / Nergy101
tags: [analytics, privacy, umami, self-hosted, web-analytics, gdpr, docker]
---

# Umami - Privacy-Focused Web Analytics

Umami is a simple, fast, privacy-focused alternative to Google Analytics. It's designed to give you the insights you need while respecting your users' privacy and complying with GDPR regulations.

## What is Umami?

Umami is an open-source web analytics platform that provides essential website analytics without tracking personal data or using cookies. It's built with privacy in mind and offers a lightweight, self-hosted solution for website analytics.

### Key Features

- **Privacy-First**: No cookies, no personal data collection, GDPR compliant
- **Lightweight**: Small tracking script (2KB) with minimal impact on page load
- **Real-time Data**: Live dashboard with real-time visitor statistics
- **Multiple Websites**: Track multiple websites from a single dashboard
- **Custom Events**: Track custom events and conversions
- **Export Data**: Export analytics data in various formats
- **Self-Hosted**: Complete control over your data and infrastructure
- **Docker Support**: Easy deployment with Docker and Docker Compose
- **API Access**: RESTful API for custom integrations

## Installation

### Using Docker Compose (Recommended)

The easiest way to get started with Umami is using Docker Compose:

```yaml
version: '3'

services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://umami:umami@db:5432/umami
      DATABASE_TYPE: postgresql
      HASH_SALT: your-hash-salt-here
      JWT_SECRET: your-jwt-secret-here
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: umami
    volumes:
      - umami-db-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  umami-db-data:
```

Save this as `docker-compose.yml` and run:

```bash
docker-compose up -d
```

### Manual Installation

For manual installation with Node.js:

```bash
# Clone the repository
git clone https://github.com/umami-software/umami.git
cd umami

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Edit .env file with your configuration
nano .env

# Run database migrations
npm run db:migrate

# Build the application
npm run build

# Start the application
npm start
```

## Configuration

### Environment Variables

Configure Umami with environment variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/umami
DATABASE_TYPE=postgresql  # or mysql

# Security
HASH_SALT=your-random-hash-salt
JWT_SECRET=your-jwt-secret

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Umami
NEXT_PUBLIC_APP_DESCRIPTION=Privacy-focused web analytics

# Optional: Email Configuration
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### Initial Setup

1. **Access the Application**: Navigate to `http://localhost:3000`
2. **Create Admin Account**: Set up your first admin user
3. **Add Website**: Create your first website tracking
4. **Get Tracking Code**: Copy the tracking script to your website

## Website Tracking

### Adding a Website

1. **Navigate to Websites**: Go to Settings → Websites
2. **Add Website**: Click "Add Website"
3. **Configure Settings**:
   - **Name**: Website name
   - **Domain**: Website domain (e.g., `example.com`)
   - **Owner**: Website owner
   - **Public**: Make website public or private

### Tracking Script

Add the tracking script to your website:

```html
<!-- Basic tracking script -->
<script
  async
  defer
  src="http://localhost:3000/umami.js"
  data-website-id="your-website-id"
></script>

<!-- With custom domain -->
<script
  async
  defer
  src="https://analytics.yourdomain.com/umami.js"
  data-website-id="your-website-id"
></script>
```

### Advanced Tracking

#### Custom Events

Track custom events:

```javascript
// Track page views
umami.track('page-view', { url: '/about', title: 'About Us' });

// Track button clicks
umami.track('button-click', { button: 'signup', location: 'header' });

// Track form submissions
umami.track('form-submit', { form: 'contact', page: '/contact' });

// Track e-commerce events
umami.track('purchase', {
  value: 99.99,
  currency: 'USD',
  product: 'Premium Plan',
});
```

#### Goal Tracking

Set up conversion goals:

1. **Create Goal**: Go to Settings → Goals
2. **Configure Goal**:
   - **Name**: Goal name (e.g., "Sign Up")
   - **Type**: Event or page view
   - **Target**: Event name or URL path
   - **Website**: Associated website

## Dashboard Features

### Overview

The dashboard provides key metrics:

- **Page Views**: Total page views over time
- **Visitors**: Unique visitors and sessions
- **Bounce Rate**: Percentage of single-page sessions
- **Average Session Duration**: Time spent on website
- **Top Pages**: Most visited pages
- **Top Referrers**: Traffic sources

### Real-time Data

Monitor live activity:

- **Current Visitors**: Active users right now
- **Live Events**: Real-time event tracking
- **Page Views**: Live page view updates
- **Referrers**: Current traffic sources

### Reports

Generate detailed reports:

- **Traffic Sources**: Where visitors come from
- **Page Performance**: Individual page statistics
- **Device Types**: Desktop, mobile, tablet usage
- **Browser Analytics**: Browser and OS statistics
- **Geographic Data**: Visitor locations (country level)

## Privacy Features

### GDPR Compliance

Umami is designed with privacy in mind:

- **No Cookies**: Doesn't use cookies for tracking
- **No Personal Data**: Doesn't collect personal information
- **IP Anonymization**: Option to anonymize IP addresses
- **Data Retention**: Configurable data retention periods
- **User Consent**: Built-in consent management

### Data Collection

What Umami tracks:

- **Page Views**: URLs and page titles
- **Referrers**: Traffic sources
- **Device Info**: Browser, OS, device type
- **Geographic Data**: Country (no city/region)
- **Session Data**: Visit duration and pages viewed

What Umami doesn't track:

- **Personal Information**: Names, emails, phone numbers
- **IP Addresses**: Can be anonymized
- **Cross-site Tracking**: No cross-domain tracking
- **Fingerprinting**: No browser fingerprinting

## API Integration

### REST API

Umami provides a RESTful API for data access:

```bash
# Get website statistics
curl -X GET "http://localhost:3000/api/website/1/stats" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get page views
curl -X GET "http://localhost:3000/api/website/1/pageviews" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get events
curl -X GET "http://localhost:3000/api/website/1/events" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Webhook Support

Configure webhooks for real-time data:

```javascript
// Example webhook payload
{
  "type": "pageview",
  "website": "website-id",
  "url": "/page",
  "referrer": "https://google.com",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Customization

### Themes

Customize the dashboard appearance:

1. **Go to Settings**: Navigate to Settings → Profile
2. **Select Theme**: Choose light or dark theme
3. **Custom Colors**: Set custom color schemes
4. **Logo**: Upload custom logo

### Custom Reports

Create custom reports:

1. **Report Builder**: Use the report builder interface
2. **Date Ranges**: Select custom date ranges
3. **Metrics**: Choose specific metrics to display
4. **Export**: Export reports in CSV or JSON format

## Performance Optimization

### Database Optimization

Optimize database performance:

```sql
-- Create indexes for better performance
CREATE INDEX idx_pageview_website_id ON pageview(website_id);
CREATE INDEX idx_pageview_created_at ON pageview(created_at);
CREATE INDEX idx_session_website_id ON session(website_id);
```

### Caching

Implement caching strategies:

- **Redis Cache**: Use Redis for session caching
- **CDN**: Serve static assets via CDN
- **Database Connection Pooling**: Optimize database connections

### Monitoring

Monitor Umami performance:

- **Application Logs**: Check application logs
- **Database Performance**: Monitor database queries
- **Resource Usage**: Track CPU and memory usage
- **Error Tracking**: Monitor error rates

## Security

### Access Control

Secure your Umami installation:

1. **Strong Passwords**: Use strong admin passwords
2. **HTTPS**: Always use HTTPS in production
3. **Firewall Rules**: Restrict access to necessary ports
4. **Regular Updates**: Keep Umami updated

### Data Protection

Protect your analytics data:

1. **Backup Strategy**: Regular database backups
2. **Encryption**: Encrypt data at rest and in transit
3. **Access Logs**: Monitor access to the application
4. **Data Retention**: Implement data retention policies

## Troubleshooting

### Common Issues

**Tracking Script Not Working**

- Check website ID is correct
- Verify script is loaded on all pages
- Check browser console for errors
- Ensure domain is configured correctly

**No Data Showing**

- Verify tracking script is installed
- Check database connection
- Review application logs
- Confirm website is active

**Performance Issues**

- Monitor database performance
- Check server resources
- Optimize database queries
- Review caching configuration

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variable
DEBUG=true

# Check application logs
docker logs umami-app

# Check database logs
docker logs umami-db
```

## Backup and Recovery

### Database Backup

Backup your analytics data:

```bash
# PostgreSQL backup
docker exec umami-db pg_dump -U umami umami > umami-backup.sql

# MySQL backup
docker exec umami-db mysqldump -u umami -p umami > umami-backup.sql
```

### Configuration Backup

Backup configuration files:

```bash
# Backup environment file
cp .env .env.backup

# Backup Docker Compose file
cp docker-compose.yml docker-compose.yml.backup
```

### Restore Process

Restore from backup:

1. **Stop Services**: Stop Umami containers
2. **Restore Database**: Import database backup
3. **Restore Configuration**: Restore config files
4. **Start Services**: Restart containers
5. **Verify Data**: Check analytics data is restored

## Comparison with Other Analytics

### vs Google Analytics

**Umami Advantages:**

- Privacy-focused, no personal data collection
- GDPR compliant out of the box
- Lightweight tracking script
- Self-hosted, complete data control
- Simple, focused interface

**Google Analytics Advantages:**

- More advanced features
- Better integration ecosystem
- Machine learning insights
- Free tier available

### vs Plausible Analytics

**Umami Advantages:**

- Self-hosted option available
- More customization options
- Lower cost for high traffic
- Complete data ownership

**Plausible Advantages:**

- Hosted solution, no maintenance
- Simpler setup
- Built-in privacy features
- Professional support

## Best Practices

### Implementation

1. **Test in Development**: Test tracking before production
2. **Verify Installation**: Check tracking is working correctly
3. **Monitor Performance**: Ensure minimal impact on page load
4. **Regular Backups**: Schedule regular data backups

### Data Management

1. **Data Retention**: Set appropriate retention periods
2. **Data Export**: Regular exports for long-term storage
3. **Privacy Review**: Regular privacy compliance reviews
4. **User Communication**: Inform users about analytics

### Performance

1. **Optimize Queries**: Monitor and optimize database queries
2. **Caching**: Implement appropriate caching strategies
3. **Resource Monitoring**: Monitor server resource usage
4. **Scaling**: Plan for traffic growth

## Conclusion

Umami provides an excellent privacy-focused alternative to traditional web analytics platforms. Its lightweight design, privacy-first approach, and self-hosted option make it ideal for developers and organizations that value user privacy and data control.

Whether you're looking to replace Google Analytics or starting fresh with a privacy-compliant solution, Umami offers the essential analytics features you need without compromising user privacy.

### Resources

- **Official Repository**: [https://github.com/umami-software/umami](https://github.com/umami-software/umami)
- **Documentation**: [https://umami.is/docs](https://umami.is/docs)
- **Demo**: [https://app.umami.is](https://app.umami.is)
- **Community**: [GitHub Discussions](https://github.com/umami-software/umami/discussions)

---

_This guide covers the essential aspects of setting up and using Umami for privacy-focused web analytics. For advanced configurations and troubleshooting, refer to the official documentation and community resources._
