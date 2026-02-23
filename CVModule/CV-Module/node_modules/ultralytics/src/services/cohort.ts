import pool from '../db';

export interface CohortQuery {
  cohortEvent: string;          // Event that defines cohort membership (e.g., 'signup')
  returnEvent: string;          // Event to measure retention (e.g., 'login')
  startDate: string;            // Start of cohort analysis period
  endDate: string;              // End of cohort analysis period
  granularity: 'day' | 'week' | 'month';  // Cohort grouping granularity
  periods: number;              // Number of periods to track
}

export interface CohortPeriod {
  period: number;
  count: number;
  retentionRate: number;
}

export interface CohortRow {
  cohortDate: string;
  cohortSize: number;
  periods: CohortPeriod[];
}

export interface CohortResult {
  cohorts: CohortRow[];
  totalUsers: number;
  averageRetention: number[];
  granularity: string;
}

/**
 * Get the SQL date truncation function for the given granularity
 */
function getDateTrunc(granularity: 'day' | 'week' | 'month'): string {
  return granularity;
}

/**
 * Get the SQL interval for the given granularity
 */
function getInterval(granularity: 'day' | 'week' | 'month', periods: number): string {
  return `${periods} ${granularity}s`;
}

/**
 * Analyze cohort retention over time
 */
export async function analyzeCohort(query: CohortQuery): Promise<CohortResult> {
  const { cohortEvent, returnEvent, startDate, endDate, granularity, periods } = query;
  
  // First, get all users grouped by their cohort date
  const cohortQuery = `
    WITH cohort_users AS (
      SELECT 
        user_id,
        DATE_TRUNC($1, MIN(timestamp)) as cohort_date
      FROM events
      WHERE event_name = $2
        AND timestamp >= $3
        AND timestamp <= $4
        AND user_id IS NOT NULL
      GROUP BY user_id
    ),
    return_events AS (
      SELECT 
        e.user_id,
        DATE_TRUNC($1, e.timestamp) as event_date
      FROM events e
      WHERE e.event_name = $5
        AND e.user_id IS NOT NULL
    )
    SELECT 
      cu.cohort_date,
      EXTRACT(${granularity === 'day' ? 'DAY' : granularity === 'week' ? 'WEEK' : 'MONTH'} FROM (re.event_date - cu.cohort_date)) as period_number,
      COUNT(DISTINCT cu.user_id) as user_count
    FROM cohort_users cu
    LEFT JOIN return_events re ON cu.user_id = re.user_id
      AND re.event_date >= cu.cohort_date
    GROUP BY cu.cohort_date, period_number
    ORDER BY cu.cohort_date, period_number
  `;
  
  // For simplicity in this implementation, we'll use a more straightforward approach
  const simpleCohortQuery = `
    WITH cohort_users AS (
      SELECT 
        user_id,
        DATE_TRUNC($1, MIN(timestamp)) as cohort_date
      FROM events
      WHERE event_name = $2
        AND timestamp >= $3
        AND timestamp <= $4
        AND user_id IS NOT NULL
      GROUP BY user_id
    )
    SELECT 
      cohort_date,
      COUNT(DISTINCT user_id) as cohort_size
    FROM cohort_users
    GROUP BY cohort_date
    ORDER BY cohort_date
  `;
  
  const cohortResult = await pool.query(simpleCohortQuery, [
    granularity,
    cohortEvent,
    startDate,
    endDate
  ]);
  
  const cohorts: CohortRow[] = [];
  let totalUsers = 0;
  const periodTotals: number[] = new Array(periods).fill(0);
  const periodCounts: number[] = new Array(periods).fill(0);
  
  for (const row of cohortResult.rows) {
    const cohortDate = row.cohort_date;
    const cohortSize = parseInt(row.cohort_size, 10);
    totalUsers += cohortSize;
    
    // Get retention for each period
    const periodResults: CohortPeriod[] = [];
    
    for (let p = 0; p < periods; p++) {
      // Query users who returned in this period
      const retentionQuery = `
        WITH cohort_users AS (
          SELECT user_id
          FROM events
          WHERE event_name = $1
            AND DATE_TRUNC($2, timestamp) = $3
            AND user_id IS NOT NULL
          GROUP BY user_id
        )
        SELECT COUNT(DISTINCT e.user_id) as return_count
        FROM events e
        INNER JOIN cohort_users cu ON e.user_id = cu.user_id
        WHERE e.event_name = $4
          AND e.timestamp >= $3::timestamp + ($5 || ' ' || $2)::interval
          AND e.timestamp < $3::timestamp + ($6 || ' ' || $2)::interval
      `;
      
      const retentionResult = await pool.query(retentionQuery, [
        cohortEvent,
        granularity,
        cohortDate,
        returnEvent,
        p.toString(),
        (p + 1).toString()
      ]);
      
      const returnCount = parseInt(retentionResult.rows[0]?.return_count || '0', 10);
      const retentionRate = cohortSize > 0 ? (returnCount / cohortSize) * 100 : 0;
      
      periodResults.push({
        period: p,
        count: returnCount,
        retentionRate: Math.round(retentionRate * 100) / 100
      });
      
      periodTotals[p] += retentionRate;
      periodCounts[p]++;
    }
    
    cohorts.push({
      cohortDate: cohortDate.toISOString().split('T')[0],
      cohortSize,
      periods: periodResults
    });
  }
  
  // Calculate average retention for each period
  const averageRetention = periodTotals.map((total, idx) => 
    periodCounts[idx] > 0 ? Math.round((total / periodCounts[idx]) * 100) / 100 : 0
  );
  
  return {
    cohorts,
    totalUsers,
    averageRetention,
    granularity
  };
}
