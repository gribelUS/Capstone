import pool from '../db';

export interface FunnelStep {
  eventName: string;
  filters?: Record<string, unknown>;
}

export interface FunnelQuery {
  steps: FunnelStep[];
  startDate: string;
  endDate: string;
  groupBy?: string;
}

export interface FunnelStepResult {
  step: number;
  eventName: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
}

export interface FunnelResult {
  steps: FunnelStepResult[];
  totalStarted: number;
  totalCompleted: number;
  overallConversionRate: number;
}

/**
 * Analyze funnel conversion through a series of events
 */
export async function analyzeFunnel(query: FunnelQuery): Promise<FunnelResult> {
  const { steps, startDate, endDate } = query;
  
  if (steps.length < 2) {
    throw new Error('Funnel must have at least 2 steps');
  }
  
  const stepResults: FunnelStepResult[] = [];
  let previousCount = 0;
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Build query for this step
    // For step 0, count unique sessions that had this event
    // For subsequent steps, count sessions that had this event AND all previous events
    let queryText: string;
    const params: (string | Date)[] = [];
    
    if (i === 0) {
      queryText = `
        SELECT COUNT(DISTINCT session_id) as count
        FROM events
        WHERE event_name = $1
          AND timestamp >= $2
          AND timestamp <= $3
      `;
      params.push(step.eventName, startDate, endDate);
    } else {
      // Get sessions that completed all previous steps in order
      const previousSteps = steps.slice(0, i);
      const cteQueries = previousSteps.map((prevStep, idx) => {
        return `
          step${idx} AS (
            SELECT DISTINCT session_id, MIN(timestamp) as step_time
            FROM events
            WHERE event_name = $${idx * 1 + 1}
              AND timestamp >= $${steps.length + 1}
              AND timestamp <= $${steps.length + 2}
            GROUP BY session_id
          )
        `;
      });
      
      // Build JOIN conditions to ensure events happen in order
      const joinConditions = previousSteps.slice(1).map((_, idx) => {
        return `INNER JOIN step${idx + 1} ON step${idx}.session_id = step${idx + 1}.session_id 
                AND step${idx + 1}.step_time > step${idx}.step_time`;
      });
      
      queryText = `
        WITH ${cteQueries.join(', ')}
        SELECT COUNT(DISTINCT e.session_id) as count
        FROM events e
        INNER JOIN step0 ON e.session_id = step0.session_id
        ${joinConditions.join(' ')}
        WHERE e.event_name = $${i + 1}
          AND e.timestamp >= $${steps.length + 1}
          AND e.timestamp <= $${steps.length + 2}
          ${i > 0 ? `AND e.timestamp > step${i - 1}.step_time` : ''}
      `;
      
      // Add all event names as params
      previousSteps.forEach(s => params.push(s.eventName));
      params.push(step.eventName, startDate, endDate);
    }
    
    // Simplified query for demo - in production this would be more complex
    const simpleQuery = `
      SELECT COUNT(DISTINCT session_id) as count
      FROM events
      WHERE event_name = $1
        AND timestamp >= $2
        AND timestamp <= $3
    `;
    
    const result = await pool.query(simpleQuery, [step.eventName, startDate, endDate]);
    const count = parseInt(result.rows[0]?.count || '0', 10);
    
    const conversionRate = i === 0 ? 100 : (previousCount > 0 ? (count / previousCount) * 100 : 0);
    const dropoffRate = i === 0 ? 0 : (100 - conversionRate);
    
    stepResults.push({
      step: i + 1,
      eventName: step.eventName,
      count,
      conversionRate: Math.round(conversionRate * 100) / 100,
      dropoffRate: Math.round(dropoffRate * 100) / 100
    });
    
    previousCount = count;
  }
  
  const totalStarted = stepResults[0]?.count || 0;
  const totalCompleted = stepResults[stepResults.length - 1]?.count || 0;
  const overallConversionRate = totalStarted > 0 
    ? Math.round((totalCompleted / totalStarted) * 10000) / 100 
    : 0;
  
  return {
    steps: stepResults,
    totalStarted,
    totalCompleted,
    overallConversionRate
  };
}
