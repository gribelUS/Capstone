# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2025-01-17

### Changed
- Updated examples to use `ultralytics` npm package instead of local file references
- Updated all Node.js version requirements to 18+ in documentation
- Added npm badge and installation instructions to README
- Added prerequisites sections to example READMEs

## [1.1.0] - 2025-01-15

### Added
- GitHub Actions workflow for automated NPM publishing with provenance
- Uses OpenID Connect (OIDC) for secure, tokenless authentication

## [1.0.0] - 2024-10-01

This is the first stable release of Ultralytics! After 6+ years of development and testing, we're confident the API is stable and ready for production use.

### Added
- New `reset()` method for clearing client state on logout
- Support for custom `sessionId` in init options
- Support for custom `sessionTimeout` in init options
- `respectDoNotTrack` option (default: true) to honor browser DNT setting
- `ClientStats` and `DebugInfo` types exported for TypeScript users
- Production deployment guide with comprehensive documentation
- Scaling guide for high-volume deployments
- End-to-end test suite with Playwright
- Next.js example application
- Kubernetes health check probes (`/healthz` and `/readyz`)
- Database partitioning migration for large-scale deployments
- Performance benchmarks and testing suite

### Fixed
- Edge case in batch processing for large batches (>1000 events)
- Various dependency security updates

### Changed
- Finalized TypeScript type exports for 1.0 release
- Node.js 18 LTS is now the minimum supported version
- API is now considered stable - breaking changes will follow semver

### Deprecated
- `trackEvent()` method deprecated in favor of `track()` - will be removed in v2.0.0

### Migration Guide

Upgrading from v0.9.0 to v1.0.0:

1. Update your package: `npm install ultralytics@1.0.0`
2. Review deprecated methods - `trackEvent()` should be replaced with `track()`
3. (Optional) Run the new database migration for partitioning: `npm run migrate`
4. (Optional) Update Kubernetes deployments to use new health check endpoints

No breaking changes from v0.9.0.

## [0.9.0] - 2023-12-15

### Added
- Vue.js integration with `useUltralytics` composable
- Svelte integration with reactive store
- ARM64 Docker image support for Apple Silicon and ARM servers
- Database connection retry logic with exponential backoff
- Materialized views for improved dashboard query performance
- New database indexes for analytics queries
- Enhanced debug mode with better error context

### Changed
- **BREAKING**: Updated to Node.js 18 LTS (minimum required version)
- Improved Docker build caching for faster CI/CD pipelines
- Updated all dependencies to latest versions
- Enhanced error messages with more debugging context

### Security
- Added Helmet.js for security headers
- Timing-safe API key comparison to prevent timing attacks
- Updated vulnerable dependencies identified in security audit

### Performance
- Optimized dashboard queries with materialized views
- Added indexes for funnel and cohort analytics queries
- Multi-stage Docker builds for smaller images

## [0.5.0] - 2022-12-12

### Added
- Example React application demonstrating SDK integration
- Funnel analysis endpoint (`POST /api/analytics/funnel`)
- Cohort analysis endpoint (`POST /api/analytics/cohort`)
- SSL/TLS support in Docker production setup
- Automatic page view tracking for SPAs (`autoTrack` option)
- Prometheus metrics endpoint (`GET /metrics`)
- User privacy controls and data deletion (`DELETE /api/users/:id/data`)
- Event replay functionality for debugging
- Debug mode for client SDK

### Changed
- Improved client bundle size with better tree-shaking (~3kb gzipped)
- Enhanced rollup configuration for smaller builds

### Security
- **CRITICAL**: Fixed XSS vulnerability in event property storage. All string values in event properties are now sanitized to prevent script injection attacks. Users are strongly advised to upgrade.

### Documentation
- Updated CONTRIBUTING.md with TypeScript guidelines and new architecture
- Added comprehensive architecture documentation (`docs/architecture.md`)

## [0.4.0] - 2021-12-10

### Added
- Full TypeScript support for both server and client
- React hooks (`useUltralytics`) for React applications
- ES module build output for modern bundlers
- Kubernetes deployment manifests
- Nginx reverse proxy configuration for production
- API documentation with OpenAPI/Swagger UI at `/docs`
- Dashboard query endpoints (`/api/dashboard/summary`, `/api/dashboard/events-over-time`)
- Data export endpoint (`/api/export`) with CSV and JSON formats
- Database query performance logging with configurable thresholds

### Changed
- **BREAKING**: License changed from MIT to Apache 2.0
- Server and client code migrated to TypeScript
- Improved build tooling with Rollup ESM output
- Production Docker Compose configuration added

### Documentation
- Updated README with TypeScript and React examples
- Added API reference documentation

## [0.3.0] - 2020-12-15

### Added
- Dockerfile for containerized deployment
- Docker Compose configuration for local development
- Database migrations system using node-pg-migrate
- Jest test suite with server and client tests
- GitHub Actions CI pipeline
- Minified client build with source maps
- Database backup script with retention policy

### Changed
- Updated to Node.js 14 LTS
- Updated dependencies for security and performance

### Fixed
- Race condition in client session tracking

## [0.2.0] - 2019-12-05

### Added
- Request logging with Morgan middleware
- API key authentication for secure access
- Rate limiting to prevent abuse
- User identification (`identify()` method)
- Data retention policies with automated cleanup
- Batch event ingestion (`POST /api/events/batch`)
- Centralized error handling with error codes
- Database connection pooling for improved performance
- Enhanced health check with database status
- Event property validation with JSON Schema
- Database indexes for improved query performance

### Fixed
- Memory leak in client library event listeners

### Documentation
- Added CONTRIBUTING.md with contribution guidelines

## [0.1.0] - 2018-08-01

### Added
- Initial release of Ultralytics analytics platform
- Express-based server with PostgreSQL backend
- Event tracking endpoint (`POST /api/events`)
- Event query endpoint (`GET /api/events`) with date range filtering
- Browser client library with `init()` and `track()` methods
- Page view tracking (`trackPageView()`)
- Custom event tracking (`trackEvent()`)
- Session tracking with automatic 30-minute timeout
- Configuration via environment variables
- Health check endpoint

### Notes
- This is the first public release
- Self-hosted analytics for privacy-conscious applications
