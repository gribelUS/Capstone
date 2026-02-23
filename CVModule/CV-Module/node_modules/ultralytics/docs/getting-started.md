# Getting Started with Ultralytics

This guide will help you get Ultralytics up and running quickly.

## Prerequisites

- Node.js 18 or higher
- PostgreSQL 12 or higher (or Docker)
- npm or yarn

## Quick Start with Docker

The fastest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/aibubba/ultralytics.git
cd ultralytics

# Start the services
docker-compose up -d

# Verify everything is running
curl http://localhost:3000/health
```

That's it! Ultralytics is now running on `http://localhost:3000`.

## Quick Start without Docker

### 1. Install Dependencies

```bash
git clone https://github.com/aibubba/ultralytics.git
cd ultralytics
npm install
```

### 2. Set Up PostgreSQL

Create a database for Ultralytics:

```sql
CREATE DATABASE ultralytics;
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your database connection string:

```
DATABASE_URL=postgres://user:password@localhost:5432/ultralytics
```

### 4. Run Migrations

```bash
npm run migrate:up
```

### 5. Generate an API Key

```bash
npm run generate-api-key
```

Save the generated API key - you'll need it for the client.

### 6. Start the Server

```bash
npm start
```

The server is now running on `http://localhost:3000`.

## Add Tracking to Your Website

### Option 1: Script Tag (Simplest)

Add this to your HTML:

```html
<script src="https://your-server.com/ultralytics.min.js"></script>
<script>
  Ultralytics.init({
    endpoint: 'https://your-server.com',
    apiKey: 'your-api-key'
  });
  
  // Track page views automatically
  Ultralytics.trackPageView();
</script>
```

### Option 2: NPM Package

Install the package:

```bash
npm install ultralytics
```

Use in your code:

```javascript
import { Ultralytics } from 'ultralytics';

const analytics = new Ultralytics({
  endpoint: 'https://your-server.com',
  apiKey: 'your-api-key'
});

// Track events
analytics.track('button_clicked', { buttonId: 'signup' });
```

## Verify It's Working

1. **Check the health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Send a test event:**
   ```bash
   curl -X POST http://localhost:3000/api/events \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"name": "test_event", "properties": {"source": "curl"}}'
   ```

3. **Query your events:**
   ```bash
   curl "http://localhost:3000/api/events" \
     -H "X-API-Key: your-api-key"
   ```

## Next Steps

- [Configuration Guide](./configuration.md) - Learn about all configuration options
- [API Reference](./api-reference.md) - Complete API documentation
- [Privacy Features](./privacy.md) - Data anonymization and user privacy
- [Production Deployment](./production-deployment.md) - Deploy to production
