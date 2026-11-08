export type ServiceId = 'web' | 'api' | 'database';
export type ServiceStatus = 'healthy' | 'degraded' | 'failing';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type AgentRole = 'monitor' | 'triage' | 'diagnose' | 'responder';
export type AgentState = 'idle' | 'thinking' | 'typing' | 'done';

export interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  level: LogLevel;
  message: string;
}

export interface RunbookEntry {
  id: string;
  serviceId: ServiceId;
  serviceName: string;
  title: string;
  symptomSignature: string;
  rootCausePattern: string;
  fixCommand: string;
  verificationCheck: string;
  estimatedRecoverySec: number;
}

export interface ServiceConfig {
  id: ServiceId;
  name: string;
  cluster: string;
  baseUptime: number;
  failingUptime: number;
  baseLatencyRange: [number, number];
  failingLatencyRange: [number, number];
  failureScenarioTitle: string;
  failureScenarioShort: string;
  severity: 'Low' | 'High' | 'Critical';
  userImpact: string;
  runbookId: string;
  fixCommand: string;
  rootCauseShort: string;
  errorLogs: Array<{ level: LogLevel; message: string }>;
  recoveryLogs: Array<{ level: LogLevel; message: string }>;
  fallbackAgentOutputs: Record<AgentRole, string>;
}

export interface IncidentRecord {
  id: string;
  timestamp: string;
  serviceId: ServiceId;
  serviceName: string;
  severity: 'Low' | 'High' | 'Critical';
  rootCause: string;
  proposedFix: string;
  runbookId: string;
  status: 'Resolved' | 'Acknowledged';
  resolutionSeconds: number;
  autoDiagnosed: boolean;
}

export const RUNBOOKS: RunbookEntry[] = [
  {
    id: 'RB-101',
    serviceId: 'web',
    serviceName: 'Web Frontend',
    title: 'SSR Worker Heap Exhaustion & 502 Bad Gateway Recovery',
    symptomSignature: 'HTTP 502 Bad Gateway > 25%, Node V8 old_space heap > 95%, worker OOM exit code 137',
    rootCausePattern: 'Unbounded SSR request context cache retaining closures across concurrent page renders',
    fixCommand: 'docker restart web-frontend-ssr',
    verificationCheck: 'curl -s -o /dev/null -w "%{http_code}" https://edge.opspilot.internal/healthz == 200',
    estimatedRecoverySec: 18
  },
  {
    id: 'RB-204',
    serviceId: 'api',
    serviceName: 'API Gateway',
    title: 'Rate Limit Token Bucket Saturation & Upstream Timeout Cascade',
    symptomSignature: 'HTTP 429 + 504 Gateway Timeout spike, Envoy upstream_rq_timeout, p99 latency > 3,000ms',
    rootCausePattern: 'Client retry storm exhausting Redis rate-limit token buckets and starving Envoy worker threads',
    fixCommand: 'docker restart api-gateway',
    verificationCheck: 'envoy-admin /clusters | grep "api_upstream::health_flags::healthy"',
    estimatedRecoverySec: 22
  },
  {
    id: 'RB-309',
    serviceId: 'database',
    serviceName: 'Database',
    title: 'PostgreSQL Connection Pool Exhaustion & Idle-in-Transaction Lock Purge',
    symptomSignature: 'FATAL: remaining connection slots are reserved for non-replication superuser connections (500/500)',
    rootCausePattern: 'Orphaned batch transaction holding row locks on orders_ledger and wedging PgBouncer pool slots',
    fixCommand: 'docker restart pgbouncer-pooler',
    verificationCheck: 'psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = \'idle in transaction\';" < 5',
    estimatedRecoverySec: 25
  }
];

export const SERVICES_CONFIG: Record<ServiceId, ServiceConfig> = {
  web: {
    id: 'web',
    name: 'Web Frontend',
    cluster: 'us-east-edge-01',
    baseUptime: 99.98,
    failingUptime: 94.12,
    baseLatencyRange: [22, 34],
    failingLatencyRange: [2180, 2890],
    failureScenarioTitle: '502 Bad Gateway from SSR memory leak',
    failureScenarioShort: 'V8 heap exhaustion on SSR worker pool causing 502 Bad Gateway responses',
    severity: 'High',
    userImpact: '~38% of edge HTTP requests returning 502 Bad Gateway across US-East and EU-Central.',
    runbookId: 'RB-101',
    fixCommand: 'docker restart web-frontend-ssr',
    rootCauseShort: 'Unbounded SSR V8 heap allocation leak causing worker OOM kills and upstream 502 responses.',
    errorLogs: [
      { level: 'WARN', message: '[ssr-worker-04] V8 old_space heap utilization reached 91.4% (1872MB / 2048MB)' },
      { level: 'WARN', message: '[ssr-worker-02] GC mark-sweep pause took 642ms; event loop lag exceeded threshold (810ms)' },
      { level: 'ERROR', message: '[ssr-worker-04] FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory' },
      { level: 'ERROR', message: '[supervisor] Worker process pid=48192 exited abnormally with signal SIGKILL (exit code 137 - OOM)' },
      { level: 'ERROR', message: '[nginx-edge] upstream prematurely closed connection while reading response header from upstream (10.24.8.14:3000)' },
      { level: 'ERROR', message: '[nginx-edge] GET /dashboard/overview HTTP/2.0 -> 502 Bad Gateway (upstream_response_time: 2.640s)' },
      { level: 'WARN', message: '[ssr-worker-01] V8 old_space heap utilization reached 96.8% (1982MB / 2048MB); GC thrashing detected' },
      { level: 'ERROR', message: '[ssr-worker-01] FATAL ERROR: Ineffective mark-compacts near heap limit - allocation failed' },
      { level: 'ERROR', message: '[nginx-edge] POST /checkout/session HTTP/2.0 -> 502 Bad Gateway (error_rate=38.4% over 30s window)' },
      { level: 'ERROR', message: '[health-prober] Readiness probe failed for web-frontend-ssr: HTTP 502 after 2480ms' }
    ],
    recoveryLogs: [
      { level: 'INFO', message: '[opspilot-exec] Executing approved remediation: docker restart web-frontend-ssr' },
      { level: 'INFO', message: '[docker-daemon] Gracefully draining container web-frontend-ssr (SIGTERM sent to pid 1)' },
      { level: 'INFO', message: '[ssr-cluster] Spawned 4 fresh Node.js SSR workers (heap usage: 148MB / 2048MB, 7.2%)' },
      { level: 'INFO', message: '[nginx-edge] Upstream health check passed (200 OK in 24ms); 502 error rate dropped to 0.0%' }
    ],
    fallbackAgentOutputs: {
      monitor:
        'Detected a sharp anomaly on Web Frontend: HTTP 502 Bad Gateway responses spiked to 38.4% as p99 latency climbed past 2,480ms. V8 heap utilization on SSR worker nodes crossed 96.8% immediately prior to OOM-killer termination (exit code 137).',
      triage:
        'Assigned High severity due to active customer-facing 502 errors degrading checkout and session rendering across primary edge POPs. Estimated user impact is ~38% of active web sessions experiencing render timeouts, while static CDN assets remain nominal.',
      diagnose:
        'Root cause traced to an unbounded SSR cache closure exhausting the 2048MB Node.js worker heap and triggering Linux OOM-killer crashes. Matched incident signature to Runbook RB-101 (SSR Worker Heap Exhaustion), which prescribes a clean container restart via "docker restart web-frontend-ssr".',
      responder:
        'Web Frontend is experiencing High-severity 502 Bad Gateway errors caused by SSR worker V8 heap exhaustion matching Runbook RB-101. I have staged "docker restart web-frontend-ssr" to recycle the leaking worker containers and restore healthy upstream sockets. Dispatching on-call Telegram alert now and awaiting engineer approval.'
    }
  },
  api: {
    id: 'api',
    name: 'API Gateway',
    cluster: 'core-ingress-02',
    baseUptime: 99.99,
    failingUptime: 91.45,
    baseLatencyRange: [14, 21],
    failingLatencyRange: [3420, 4190],
    failureScenarioTitle: 'Rate limit exhausted + timeout cascade',
    failureScenarioShort: 'Token bucket lock contention + client retry storm triggering 504 timeout cascade',
    severity: 'Critical',
    userImpact: '~74% of authenticated API calls failing with 429/504 cascade across mobile and web clients.',
    runbookId: 'RB-204',
    fixCommand: 'docker restart api-gateway',
    rootCauseShort: 'Rate-limit token bucket lock contention triggering upstream worker pool starvation and 504 timeout cascade.',
    errorLogs: [
      { level: 'WARN', message: '[rate-limiter] Token bucket key="org_global_tier" exhausted (14,200 req/s > burst limit 5,000 req/s)' },
      { level: 'WARN', message: '[envoy-ingress] Retry amplification detected: client SDK backoff missing jitter, inbound QPS +285%' },
      { level: 'ERROR', message: '[rate-limiter] Redis Lua script evalsha timeout after 1200ms on mutex lock "rl:bucket:shard-03"' },
      { level: 'ERROR', message: '[api-gateway] HTTP 429 Too Many Requests surge: 4,810 rejected requests in last 5s window' },
      { level: 'WARN', message: '[envoy-pool] Upstream worker thread pool saturation at 256/256 active threads; queue depth 1,940' },
      { level: 'ERROR', message: '[api-gateway] Upstream timeout waiting for auth-verify-svc after 3500ms (HTTP 504 Gateway Timeout)' },
      { level: 'ERROR', message: '[circuit-breaker] Cluster "core-api-upstream" tripped OPEN: consecutive_5xx=48, p99_latency=3,920ms' },
      { level: 'ERROR', message: '[api-gateway] POST /v1/orders/authorize -> 504 Gateway Timeout (cascade failure rate: 74.2%)' },
      { level: 'ERROR', message: '[health-prober] Readiness probe failed on api-gateway: socket hang up after 4000ms' }
    ],
    recoveryLogs: [
      { level: 'INFO', message: '[opspilot-exec] Executing approved remediation: docker restart api-gateway' },
      { level: 'INFO', message: '[envoy-ingress] Flushed 256 wedged worker sockets and re-initialized token bucket shards' },
      { level: 'INFO', message: '[circuit-breaker] Cluster "core-api-upstream" transitioned OPEN -> HALF_OPEN -> CLOSED' },
      { level: 'INFO', message: '[api-gateway] Request latency normalized to 16ms; 429/504 cascade resolved (0.0% error rate)' }
    ],
    fallbackAgentOutputs: {
      monitor:
        'Detected a critical anomaly on API Gateway: rate-limiter token bucket exhaustion coincides with a retry storm of 14,200 req/s and p99 latency surging to 3,920ms. All 256 upstream worker threads are saturated waiting on stalled circuit-breaker sockets.',
      triage:
        'Assigned Critical severity because core authentication and order mutations are failing across both web and mobile clients. Estimated user impact is ~74% of synchronous API traffic dropping with 429 Too Many Requests and 504 Gateway Timeout errors.',
      diagnose:
        'Root cause identified as a client retry amplification loop exhausting the Redis rate-limit token bucket and starving the Envoy worker thread pool. Matched telemetry signature to Runbook RB-204 (API Gateway Rate-Limit & Timeout Cascade), which specifies executing "docker restart api-gateway" to flush wedged sockets and reset circuit breakers.',
      responder:
        'API Gateway is in a Critical timeout cascade triggered by token bucket lock contention and client retry amplification (Runbook RB-204). I have prepared "docker restart api-gateway" to drain deadlocked worker threads and re-initialize rate-limit buckets. Sending Telegram alert to the on-call engineer for immediate approval.'
    }
  },
  database: {
    id: 'database',
    name: 'Database',
    cluster: 'pg-primary-nvme-01',
    baseUptime: 99.99,
    failingUptime: 89.60,
    baseLatencyRange: [4, 9],
    failingLatencyRange: [4250, 4890],
    failureScenarioTitle: 'Connection pool exhausted (500/500 slots)',
    failureScenarioShort: 'PostgreSQL connection pool saturated by orphaned idle-in-transaction locks',
    severity: 'Critical',
    userImpact: '92% of write transactions blocked; global read-replica lag exceeding 18.4 seconds.',
    runbookId: 'RB-309',
    fixCommand: 'docker restart pgbouncer-pooler',
    rootCauseShort: 'Orphaned idle-in-transaction locks saturating all 500 PostgreSQL connection slots.',
    errorLogs: [
      { level: 'WARN', message: '[pgbouncer] Connection pool utilization crossed warning water-mark: 465 / 500 active server connections' },
      { level: 'WARN', message: '[postgres-primary] 412 backend pids stuck in state="idle in transaction" for > 180s on relation "orders_ledger"' },
      { level: 'ERROR', message: '[postgres-primary] ExclusiveLock wait timeout exceeded for pid=88412 waiting on transaction 9481023' },
      { level: 'ERROR', message: '[pgbouncer] client_login_timeout: no free server connections available in pool "prod_oltp" after 4,200ms' },
      { level: 'ERROR', message: '[postgres-primary] FATAL: sorry, too many clients already (500/500 max_connections reached)' },
      { level: 'ERROR', message: '[postgres-primary] FATAL: remaining connection slots are reserved for non-replication superuser connections' },
      { level: 'WARN', message: '[wal-sender] Read replica pg-replica-02 WAL replay lag increased to 18.4s (write stall active)' },
      { level: 'ERROR', message: '[orm-client] PrismaClientInitializationError: Timed out fetching a new connection from the connection pool' },
      { level: 'ERROR', message: '[health-prober] Database synthetic write probe failed after 4,650ms (connection refused by pooler)' }
    ],
    recoveryLogs: [
      { level: 'INFO', message: '[opspilot-exec] Executing approved remediation: docker restart pgbouncer-pooler' },
      { level: 'INFO', message: '[pgbouncer] Terminated 412 orphaned idle-in-transaction backend sessions and re-established clean pool' },
      { level: 'INFO', message: '[postgres-primary] Active connection count dropped from 500/500 to 38/500; row locks released' },
      { level: 'INFO', message: '[wal-sender] Replica lag recovered to 0.04s; OLTP query latency normalized to 6ms' }
    ],
    fallbackAgentOutputs: {
      monitor:
        'Detected a severe database telemetry anomaly: active PostgreSQL connections hit 500/500 (100% pool saturation) with 412 sessions stuck in "idle in transaction". Query execution latency spiked from 6ms to 4,650ms with FATAL connection slot exhaustion errors.',
      triage:
        'Assigned Critical severity as primary database write capacity is effectively halted and read replicas are lagging by 18.4 seconds. Estimated user impact covers 92% of state-mutating requests failing across all downstream services.',
      diagnose:
        'Root cause is an unclosed batch-reporting transaction holding row-level locks on "orders_ledger" and blocking PgBouncer from recycling backend slots. Matched directly to Runbook RB-309 (PostgreSQL Connection Pool Exhaustion), which prescribes running "docker restart pgbouncer-pooler" to terminate orphaned idle transactions and reclaim connection slots.',
      responder:
        'Database is suffering Critical connection pool exhaustion (500/500 slots occupied by orphaned idle-in-transaction locks), matched to Runbook RB-309. I recommend executing "docker restart pgbouncer-pooler" to sever stalled backend transactions and restore pool headroom. Alerting on-call engineer on Telegram and holding for approval.'
    }
  }
};

export const AMBIENT_HEALTHY_LOGS: Array<{ service: string; level: LogLevel; message: string }> = [
  { service: 'web-frontend', level: 'INFO', message: 'GET /app/control-room 200 OK — SSR render completed in 19ms (cache: HIT)' },
  { service: 'api-gateway', level: 'INFO', message: 'Envoy ingress health check passed across 12 upstream endpoints (p95: 17ms)' },
  { service: 'database', level: 'INFO', message: 'PgBouncer pool "prod_oltp" steady: 42/500 active connections, checkpoint sync 5.2ms' },
  { service: 'api-gateway', level: 'INFO', message: 'Rate-limit token bucket shard sync nominal (current throughput: 1,840 req/s)' },
  { service: 'web-frontend', level: 'INFO', message: 'V8 worker heap steady at 284MB / 2048MB (13.8% utilization across 4 workers)' },
  { service: 'database', level: 'INFO', message: 'WAL replication stream synced with pg-replica-01 and pg-replica-02 (lag: 4ms)' },
  { service: 'api-gateway', level: 'INFO', message: 'POST /v1/telemetry/heartbeat 202 Accepted — mTLS handshake verified in 3ms' }
];

export const INITIAL_INCIDENT_HISTORY: IncidentRecord[] = [
  {
    id: 'INC-8490',
    timestamp: 'Earlier today · 18:14:09',
    serviceId: 'api',
    serviceName: 'API Gateway',
    severity: 'Critical',
    rootCause: 'Rate-limit token bucket lock contention triggering upstream 504 timeout cascade.',
    proposedFix: 'docker restart api-gateway',
    runbookId: 'RB-204',
    status: 'Resolved',
    resolutionSeconds: 31,
    autoDiagnosed: true
  },
  {
    id: 'INC-8486',
    timestamp: 'Earlier today · 11:42:51',
    serviceId: 'web',
    serviceName: 'Web Frontend',
    severity: 'High',
    rootCause: 'Unbounded SSR V8 heap allocation leak causing worker OOM kills and upstream 502 responses.',
    proposedFix: 'docker restart web-frontend-ssr',
    runbookId: 'RB-101',
    status: 'Resolved',
    resolutionSeconds: 26,
    autoDiagnosed: true
  }
];
