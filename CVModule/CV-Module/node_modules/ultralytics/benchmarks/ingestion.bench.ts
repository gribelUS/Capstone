import { performance } from 'perf_hooks';
import { Pool } from 'pg';
import { config } from '../src/config';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  opsPerSecond: number;
}

const ITERATIONS = parseInt(process.env.BENCH_ITERATIONS || '1000', 10);
const WARMUP = parseInt(process.env.BENCH_WARMUP || '100', 10);

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = ITERATIONS
): Promise<BenchmarkResult> {
  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await fn();
  }

  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const total = times.reduce((a, b) => a + b, 0);
  
  return {
    name,
    iterations,
    totalMs: total,
    avgMs: total / iterations,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    opsPerSecond: (iterations / total) * 1000,
  };
}

function generateEvent() {
  return {
    event_type: 'page_view',
    session_id: `sess_${Math.random().toString(36).substr(2, 9)}`,
    user_id: `user_${Math.floor(Math.random() * 10000)}`,
    timestamp: new Date().toISOString(),
    properties: {
      url: '/test-page',
      referrer: 'https://google.com',
      browser: 'Chrome',
      os: 'macOS',
    },
  };
}

async function runIngestionBenchmarks(): Promise<void> {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
  });

  console.log('Running ingestion benchmarks...\n');
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Warmup: ${WARMUP}\n`);

  // Single event insertion
  const singleInsert = await benchmark('Single event insert', async () => {
    const event = generateEvent();
    await pool.query(
      `INSERT INTO events (event_type, session_id, user_id, timestamp, properties)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.event_type, event.session_id, event.user_id, event.timestamp, event.properties]
    );
  });
  console.log(`${singleInsert.name}: ${singleInsert.avgMs.toFixed(3)}ms avg, ${singleInsert.opsPerSecond.toFixed(0)} ops/sec`);

  // Batch insertion (10 events)
  const batch10 = await benchmark('Batch insert (10 events)', async () => {
    const events = Array.from({ length: 10 }, generateEvent);
    const values = events.map((e, i) => {
      const offset = i * 5;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    }).join(', ');
    
    const params = events.flatMap(e => [e.event_type, e.session_id, e.user_id, e.timestamp, JSON.stringify(e.properties)]);
    
    await pool.query(
      `INSERT INTO events (event_type, session_id, user_id, timestamp, properties) VALUES ${values}`,
      params
    );
  }, ITERATIONS / 10);
  console.log(`${batch10.name}: ${batch10.avgMs.toFixed(3)}ms avg, ${(batch10.opsPerSecond * 10).toFixed(0)} events/sec`);


  // Batch insertion (100 events)
  const batch100 = await benchmark('Batch insert (100 events)', async () => {
    const events = Array.from({ length: 100 }, generateEvent);
    const values = events.map((e, i) => {
      const offset = i * 5;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    }).join(', ');
    
    const params = events.flatMap(e => [e.event_type, e.session_id, e.user_id, e.timestamp, JSON.stringify(e.properties)]);
    
    await pool.query(
      `INSERT INTO events (event_type, session_id, user_id, timestamp, properties) VALUES ${values}`,
      params
    );
  }, ITERATIONS / 100);
  console.log(`${batch100.name}: ${batch100.avgMs.toFixed(3)}ms avg, ${(batch100.opsPerSecond * 100).toFixed(0)} events/sec`);

  // Results summary
  const results = {
    timestamp: new Date().toISOString(),
    benchmarks: [singleInsert, batch10, batch100],
  };

  // Write results to file
  const fs = await import('fs/promises');
  const resultsDir = './benchmarks/results';
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.writeFile(
    `${resultsDir}/ingestion-${Date.now()}.json`,
    JSON.stringify(results, null, 2)
  );

  await pool.end();
  console.log('\nResults written to benchmarks/results/');
}

runIngestionBenchmarks().catch(console.error);
