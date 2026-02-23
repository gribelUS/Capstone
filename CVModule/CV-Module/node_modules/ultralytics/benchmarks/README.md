# Ultralytics Benchmarks

This directory contains performance benchmarks for the Ultralytics analytics platform.

## Running Benchmarks

### Prerequisites

- Node.js 18 or later
- PostgreSQL running (either locally or via Docker)
- Environment configured (copy `.env.example` to `.env`)

### Run All Benchmarks

```bash
npm run benchmark
```

### Run Specific Benchmark

```bash
npm run benchmark:ingestion
npm run benchmark:queries
npm run benchmark:client
```

## Benchmark Categories

### Ingestion (`ingestion.bench.ts`)

Tests event ingestion throughput:
- Single event insertion rate
- Batch insertion rate
- Concurrent request handling

### Queries (`queries.bench.ts`)

Tests query performance:
- Dashboard summary queries
- Funnel analysis queries
- Cohort analysis queries
- Event export queries

### Client (`client.bench.ts`)

Tests client library performance:
- Initialization time
- Event tracking overhead
- Batch queuing performance
- Memory usage

## Results

Benchmark results are written to `benchmarks/results/` directory in JSON format for historical tracking.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BENCH_ITERATIONS` | Number of iterations per test | 1000 |
| `BENCH_CONCURRENCY` | Concurrent requests for load tests | 10 |
| `BENCH_WARMUP` | Warmup iterations before measuring | 100 |
