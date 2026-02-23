# Ultralytics

[![npm](https://img.shields.io/npm/v/ultralytics.svg)](https://www.npmjs.com/package/ultralytics)
[![Version](https://img.shields.io/badge/version-1.1.1-blue.svg)](https://github.com/aibubba/ultralytics/releases)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tests](https://github.com/aibubba/ultralytics/workflows/Tests/badge.svg)](https://github.com/aibubba/ultralytics/actions)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

**Self-hosted analytics for web applications.** Track user behavior on your websites without sending data to third parties.

## Why Ultralytics?

- **Privacy-first**: All data stays on your servers - no third-party tracking
- **Lightweight client**: ~3kb gzipped JavaScript library
- **Framework integrations**: React, Vue, Svelte, and vanilla JavaScript
- **Production-ready**: Docker, Kubernetes, and comprehensive monitoring
- **Full control**: Open source, self-hosted, and fully customizable

## Quick Start

### Docker (Recommended)

```bash
git clone https://github.com/aibubba/ultralytics.git
cd ultralytics
docker-compose up -d
```

Ultralytics is now running on `http://localhost:3000`. For detailed setup instructions, see the [Getting Started Guide](docs/getting-started.md).

## Installation

Install the client library from npm:

```bash
npm install ultralytics
```

### Add to Your Website

```html
<script src="https://your-server.com/ultralytics.min.js"></script>
<script>
  Ultralytics.init({
    endpoint: 'https://your-server.com',
    apiKey: 'your-api-key'
  });
</script>
```

### Track Events

```javascript
// Track page views
Ultralytics.trackPageView();

// Track custom events
Ultralytics.track('button_click', {
  buttonId: 'signup-button',
  page: '/pricing'
});

// Identify users
Ultralytics.identify('user-123', {
  email: 'user@example.com',
  plan: 'premium'
});
```

## Framework Integrations

All framework integrations are included in the main package:

```bash
npm install ultralytics
```

### React

```tsx
import { useUltralytics } from 'ultralytics/react';

function App() {
  const { track, identify } = useUltralytics({
    endpoint: 'https://your-server.com',
    apiKey: 'your-api-key',
    autoTrackPageViews: true
  });

  return (
    <button onClick={() => track('cta_clicked')}>
      Get Started
    </button>
  );
}
```

### Vue

```vue
<script setup>
import { useUltralytics } from 'ultralytics/vue';

const { track } = useUltralytics({
  endpoint: 'https://your-server.com',
  apiKey: 'your-api-key'
});
</script>
```

### Svelte

```svelte
<script>
import { createUltralytics } from 'ultralytics/svelte';

const analytics = createUltralytics({
  endpoint: 'https://your-server.com',
  apiKey: 'your-api-key'
});
</script>
```

## Features

### Event Tracking
Track page views, user interactions, and custom events with rich metadata.

### Session Management
Automatic session tracking with configurable timeout (default: 30 minutes).

### User Identification
Associate events with authenticated users for cross-session analysis.

### Analytics Queries
Built-in endpoints for funnels, cohorts, and time-series analysis.

### Data Export
Export your data in CSV or JSON format for external analysis.

### Privacy Controls
GDPR-compliant data deletion and anonymization capabilities.

### Prometheus Metrics
Built-in `/metrics` endpoint for monitoring with Prometheus/Grafana.

## Documentation

- [Getting Started](docs/getting-started.md) - Quick start guide
- [Configuration](docs/configuration.md) - All configuration options
- [API Reference](docs/api-reference.md) - Complete REST API documentation
- [Privacy](docs/privacy.md) - Privacy features and GDPR compliance
- [Architecture](docs/architecture.md) - System design overview
- [SSL Setup](docs/ssl-setup.md) - HTTPS configuration

## Deployment Options

### Docker Compose

For development and simple deployments:

```bash
docker-compose up -d
```

### Docker Compose (Production)

For production with nginx and SSL:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes

For scalable production deployments:

```bash
kubectl apply -f k8s/
```

See [Production Deployment](docs/production-deployment.md) for detailed instructions.

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL 12+

### Setup

```bash
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run migrate:up
npm start
```

### Running Tests

```bash
npm test
```

### Building the Client

```bash
npm run build
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/aibubba/ultralytics/issues) - Bug reports and feature requests
- [Documentation](docs/) - Detailed guides and references
