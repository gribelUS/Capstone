# Contributing to Ultralytics

First off, thank you for considering contributing to Ultralytics! It's people like you that make Ultralytics such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct: be respectful, inclusive, and professional.

## Project Architecture

Ultralytics is a self-hosted analytics platform consisting of two main components:

- **Server**: A Node.js/Express server with PostgreSQL backend (in `src/`)
- **Client**: A lightweight browser SDK for event tracking (in `src/client.ts`)

For a detailed overview of the architecture, see [docs/architecture.md](docs/architecture.md).

### Directory Structure

```
ultralytics/
├── src/                    # TypeScript source code
│   ├── client.ts           # Browser SDK
│   ├── server.ts           # Express server entry point
│   ├── db.ts               # Database connection and queries
│   ├── config.ts           # Configuration management
│   ├── types.ts            # Shared TypeScript types
│   ├── validation.ts       # Input validation
│   ├── errors.ts           # Error definitions
│   ├── metrics.ts          # Prometheus metrics
│   ├── react.ts            # React hooks integration
│   ├── middleware/         # Express middleware
│   ├── routes/             # API route handlers
│   └── services/           # Business logic services
├── dist/                   # Compiled JavaScript output
├── migrations/             # Database migrations
├── tests/                  # Test files
├── examples/               # Example applications
├── docs/                   # Documentation
├── k8s/                    # Kubernetes manifests
└── nginx/                  # Nginx configuration
```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Describe the behavior you observed and what you expected**
- **Include your environment details** (Node.js version, OS, browser, etc.)
- **Include relevant logs or error messages**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed enhancement**
- **Explain why this enhancement would be useful**
- **Consider backward compatibility implications**

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Run the linter and fix any issues: `npm run lint`
5. Run the tests to make sure everything works: `npm test`
6. Build the project to check for TypeScript errors: `npm run build`
7. Commit your changes with a clear commit message
8. Push to your fork
9. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18 or later (LTS recommended)
- PostgreSQL 12 or later
- npm 9 or later (comes with Node.js 18+)

### Local Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/your-username/ultralytics.git
   cd ultralytics
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

4. Set up PostgreSQL (or use Docker):
   ```bash
   # Using Docker
   docker-compose up -d postgres
   
   # Or manually create a database
   createdb ultralytics
   ```

5. Run database migrations:
   ```bash
   npm run migrate:up
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

### Building the Project

```bash
# Build everything (server + client)
npm run build

# Build client library only
npm run build:client
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/server.test.ts
```

## Code Style

### TypeScript Guidelines

- Use TypeScript for all new code
- Enable strict mode (`"strict": true` in tsconfig.json)
- Prefer interfaces over type aliases for object shapes
- Use explicit return types for public functions
- Avoid `any` type; use `unknown` if type is truly unknown

### General Style

- Use 2 spaces for indentation
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused (under 50 lines ideally)
- Follow existing code patterns

### Code Examples

```typescript
// Good: Explicit types, clear naming
interface EventPayload {
  name: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

function trackEvent(payload: EventPayload): Promise<void> {
  // implementation
}

// Avoid: Implicit any, unclear naming
function track(e) {
  // implementation
}
```

### Import Order

1. Node.js built-in modules
2. External dependencies
3. Internal modules (absolute paths)
4. Relative imports

```typescript
import { readFile } from 'fs/promises';
import express from 'express';
import { Pool } from 'pg';

import { config } from './config';
import { validateEvent } from './validation';
import type { EventData } from './types';
```

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep the first line under 50 characters
- Reference issues and pull requests in the body

Example:
```
Add rate limiting to batch endpoint

- Implement sliding window rate limiting
- Add configuration for rate limit thresholds
- Update documentation

Fixes #123
```

## Testing Guidelines

- Write tests for all new features
- Update tests when modifying existing functionality
- Aim for meaningful coverage, not just high percentages
- Test edge cases and error conditions
- Use descriptive test names

```typescript
describe('trackEvent', () => {
  it('should send event to server with correct payload', async () => {
    // test implementation
  });

  it('should handle network errors gracefully', async () => {
    // test implementation
  });
});
```

## Database Migrations

When making database schema changes:

1. Create a new migration:
   ```bash
   npm run migrate create your_migration_name
   ```

2. Implement the `up` and `down` functions

3. Test the migration locally:
   ```bash
   npm run migrate:up
   npm run migrate:down
   npm run migrate:up
   ```

4. Include the migration in your PR

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing!
