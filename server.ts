import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

type ServiceId = 'web' | 'api' | 'database';
type AgentRole = 'monitor' | 'triage' | 'diagnose' | 'responder';

// Single model configuration object
const AGENT_MODEL_CONFIG = {
  fastModel: 'llama-3.1-8b-instant',
  reasoningModel: 'llama-3.3-70b-versatile',
  routes: {
    monitor: 'llama-3.1-8b-instant',
    triage: 'llama-3.1-8b-instant',
    diagnose: 'llama-3.3-70b-versatile',
    responder: 'llama-3.3-70b-versatile'
  } as Record<AgentRole, string>
};

interface ScenarioFallback {
  severity: 'Low' | 'High' | 'Critical';
  userImpact: string;
  runbookId: string;
  runbookTitle: string;
  fixCommand: string;
  rootCauseShort: string;
  responses: Record<AgentRole, string>;
}

const SCENARIO_FALLBACKS: Record<ServiceId, ScenarioFallback> = {
  web: {
    severity: 'High',
    userImpact: '~38% of edge HTTP requests returning 502 Bad Gateway across US-East and EU-Central.',
    runbookId: 'RB-101',
    runbookTitle: 'SSR Worker Heap Exhaustion & 502 Gateway Recovery',
    fixCommand: 'docker restart web-frontend-ssr',
    rootCauseShort: 'Unbounded SSR V8 heap allocation leak causing worker OOM kills and upstream 502 responses.',
    responses: {
      monitor:
        'Detected a sharp anomaly on Web Frontend: HTTP 502 Bad Gateway responses spiked to 38.4% as p99 latency climbed past 2,480ms. V8 heap utilization on SSR worker nodes crossed 98.7% immediately prior to upstream socket hang-ups.',
      triage:
        'Assigned High severity due to active customer-facing 502 errors degrading checkout and session rendering across primary edge POPs. Estimated user impact is ~38% of active web sessions experiencing render timeouts, though static CDN assets remain unaffected.',
      diagnose:
        'Root cause traced to an unbounded SSR cache closure in v2.14.3 exhausting the 2048MB Node.js worker heap and triggering Linux OOM-killer termination. Matched incident signature to Runbook RB-101 (SSR Worker Heap Exhaustion), which prescribes a rolling container restart via "docker restart web-frontend-ssr".',
      responder:
        'Web Frontend is experiencing High-severity 502 Bad Gateway errors caused by SSR worker V8 heap exhaustion matching Runbook RB-101. I have staged "docker restart web-frontend-ssr" to recycle the leaking worker containers and restore healthy upstream sockets. Dispatching on-call Telegram alert now and awaiting engineer approval to execute.'
    }
  },
  api: {
    severity: 'Critical',
    userImpact: '~74% of authenticated API calls failing with 429/504 cascade across mobile and web clients.',
    runbookId: 'RB-204',
    runbookTitle: 'API Gateway Token Bucket Saturation & Timeout Cascade',
    fixCommand: 'docker restart api-gateway',
    rootCauseShort: 'Rate-limit token bucket lock contention triggering upstream worker pool starvation and 504 timeout cascade.',
    responses: {
      monitor:
        'Detected a critical anomaly on API Gateway: rate-limiter token bucket exhaustion coincides with a retry storm of 14,200 req/s and p99 latency surging to 3,920ms. Upstream worker threads are deadlocked waiting on stalled Envoy circuit-breaker sockets.',
      triage:
        'Assigned Critical severity because core authentication and transaction mutations are failing across both web and mobile clients. Estimated user impact is ~74% of synchronous API traffic dropping with 429 Too Many Requests and 504 Gateway Timeout errors.',
      diagnose:
        'Root cause identified as a retry amplification loop exhausting the Redis-backed rate limit bucket and starving the Envoy worker thread pool. Matched telemetry signature to Runbook RB-204 (API Gateway Rate-Limit & Timeout Cascade), which specifies executing "docker restart api-gateway" to flush wedged worker sockets and reset circuit breakers.',
      responder:
        'API Gateway is in a Critical timeout cascade triggered by token bucket lock contention and client retry amplification (Runbook RB-204). I have prepared "docker restart api-gateway" to drain deadlocked worker threads and re-initialize rate-limit token buckets. Sending Telegram alert to the on-call engineer for immediate remediation approval.'
    }
  },
  database: {
    severity: 'Critical',
    userImpact: '92% of write transactions blocked; global read-replica lag exceeding 18.4 seconds.',
    runbookId: 'RB-309',
    runbookTitle: 'PostgreSQL Connection Pool Exhaustion & Lock Remediation',
    fixCommand: 'docker restart pgbouncer-pooler',
    rootCauseShort: 'Orphaned idle-in-transaction locks saturating all 500 PostgreSQL connection slots.',
    responses: {
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

// In-Memory Incident Store for the demo session
export interface ServerIncident {
  id: string;
  serviceId: ServiceId;
  serviceName: string;
  severity: string;
  rootCause: string;
  proposedFix: string;
  runbookId?: string;
  status: 'pending' | 'resolved' | 'declined';
  approvedBy?: 'telegram' | 'in-app';
  resolvedAt?: string;
  declinedAt?: string;
  telegramMessageId?: number;
  telegramChatId?: string | number;
}

const serverIncidents = new Map<string, ServerIncident>();

// In-Memory Telegram State & Overrides
let overrideTelegramChatId: string | null = null;
let latestDetectedUser: {
  id: number | string;
  username?: string;
  firstName?: string;
  timestamp: string;
} | null = null;

function hasValidGroqKey(): boolean {
  const key = process.env.GROQ_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GROQ_API_KEY' && key.length > 10);
}

function getTelegramToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') return null;
  return token;
}

function getTelegramBotId(): string | null {
  const token = getTelegramToken();
  if (!token) return null;
  const prefix = token.split(':')[0];
  return prefix && prefix.length > 3 ? prefix : null;
}

function getTelegramChatId(): string | null {
  if (overrideTelegramChatId && overrideTelegramChatId.trim()) {
    return overrideTelegramChatId.trim();
  }
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId || chatId === 'MY_TELEGRAM_CHAT_ID') return null;
  return chatId;
}

function hasValidTelegramConfig(): boolean {
  return Boolean(getTelegramToken() && getTelegramChatId());
}

function sanitizeGroqOutput(raw: string): string {
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return withoutThink
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

async function generateWithGroq(
  role: AgentRole,
  prompt: string,
  systemInstruction: string
): Promise<{ text: string; modelUsed: string; latencyMs: number } | null> {
  if (!hasValidGroqKey()) return null;

  const apiKey = process.env.GROQ_API_KEY!.trim();
  const primaryModel = AGENT_MODEL_CONFIG.routes[role];
  const alternateModel =
    primaryModel === AGENT_MODEL_CONFIG.fastModel
      ? AGENT_MODEL_CONFIG.reasoningModel
      : AGENT_MODEL_CONFIG.fastModel;

  const modelsToTry = [primaryModel, alternateModel];

  for (const modelName of modelsToTry) {
    const callStart = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 240
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = data?.choices?.[0]?.message?.content;
      if (rawContent) {
        const cleaned = sanitizeGroqOutput(rawContent);
        if (cleaned.length > 15) {
          return {
            text: cleaned,
            modelUsed: modelName,
            latencyMs: Math.max(120, Date.now() - callStart)
          };
        }
      }
    } catch {
      // Fall through to retry or fallback
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // 1. Health & Connection Status Endpoint (never exposes secrets)
  app.get('/api/status', (_req, res) => {
    res.json({
      ok: true,
      groqConnected: hasValidGroqKey(),
      telegramConnected: hasValidTelegramConfig(),
      hasWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
      models: AGENT_MODEL_CONFIG.routes,
      timestamp: new Date().toISOString()
    });
  });

  // 1b. Single Node Web Service Health Probe (Render-compatible, never exposes keys)
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      groq: hasValidGroqKey(),
      telegram: hasValidTelegramConfig()
    });
  });

  // 2. Multi-Agent Step Endpoint
  app.post('/api/agent', async (req, res) => {
    const {
      agentRole,
      serviceId = 'api',
      serviceName = 'API Gateway',
      scenarioTitle = 'Rate limit exhausted + timeout cascade',
      logs = [],
      previousOutputs = {}
    } = req.body as {
      agentRole: AgentRole;
      serviceId?: ServiceId;
      serviceName?: string;
      scenarioTitle?: string;
      logs?: string[];
      previousOutputs?: Partial<Record<AgentRole, string>>;
    };

    const validServiceId: ServiceId =
      serviceId === 'web' || serviceId === 'api' || serviceId === 'database'
        ? serviceId
        : 'api';
    const validRole: AgentRole =
      agentRole === 'monitor' ||
      agentRole === 'triage' ||
      agentRole === 'diagnose' ||
      agentRole === 'responder'
        ? agentRole
        : 'monitor';

    const scenario = SCENARIO_FALLBACKS[validServiceId];
    const fallbackOutput = scenario.responses[validRole];
    const configuredModel = AGENT_MODEL_CONFIG.routes[validRole];

    const systemInstruction = [
      'You are an autonomous AI Site Reliability Engineering agent inside OpsPilot.',
      'Respond in plain text only (no markdown bold, no bullet lists, no code fences).',
      'Write a maximum of 3 concise, high-signal sentences in a calm, authoritative on-call engineer tone.',
      'Include concrete metrics from the logs or runbook where relevant.'
    ].join(' ');

    const recentLogsText = Array.isArray(logs) ? logs.slice(-10).join('\n') : '';
    const prevContext = Object.entries(previousOutputs)
      .map(([role, text]) => `${role.toUpperCase()} AGENT: ${text}`)
      .join('\n');

    const rolePrompts: Record<AgentRole, string> = {
      monitor: `You are the Monitor Agent. Inspect the following error logs for service "${serviceName}" (Scenario: ${scenarioTitle}) and state clearly what telemetry anomaly and error rate spike you detected.\n\nLogs:\n${recentLogsText}`,
      triage: `You are the Triage Agent. Based on the Monitor Agent's findings below for "${serviceName}", assign severity "${scenario.severity}" with a crisp one-line engineering justification and state the estimated user impact (${scenario.userImpact}).\n\nPrevious context:\n${prevContext}`,
      diagnose: `You are the Diagnose Agent. Based on the context below for "${serviceName}", explain the technical root cause (${scenario.rootCauseShort}) and match it to Built-in Runbook ${scenario.runbookId} ("${scenario.runbookTitle}") with proposed fix command "${scenario.fixCommand}".\n\nPrevious context:\n${prevContext}`,
      responder: `You are the Responder Agent. Synthesize the final incident summary for "${serviceName}", confirm the staged remediation command "${scenario.fixCommand}" from Runbook ${scenario.runbookId}, and state that the Telegram alert has been dispatched to the on-call engineer awaiting approval.\n\nPrevious context:\n${prevContext}`
    };

    const groqResult = await generateWithGroq(
      validRole,
      rolePrompts[validRole],
      systemInstruction
    );

    const defaultLatencyMs =
      configuredModel === AGENT_MODEL_CONFIG.fastModel ? 410 : 680;

    res.json({
      ok: true,
      agentRole: validRole,
      serviceId: validServiceId,
      model: groqResult?.modelUsed || configuredModel,
      latencyMs: groqResult?.latencyMs || defaultLatencyMs,
      output: groqResult?.text || fallbackOutput,
      usedFallback: !groqResult,
      metadata: {
        severity: scenario.severity,
        userImpact: scenario.userImpact,
        runbookId: scenario.runbookId,
        runbookTitle: scenario.runbookTitle,
        fixCommand: scenario.fixCommand,
        rootCauseShort: scenario.rootCauseShort
      }
    });
  });

  // 3. Telegram Bot Configuration & State Endpoint
  app.get('/api/telegram/config', async (_req, res) => {
    const token = getTelegramToken();
    const botId = getTelegramBotId();
    const configuredChatId = process.env.TELEGRAM_CHAT_ID?.trim() || null;
    const activeChatId = getTelegramChatId();
    const isBotSelfChat = Boolean(botId && activeChatId === botId);

    let botUsername: string | null = null;
    let botName: string | null = null;

    if (token) {
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        if (meRes.ok) {
          const meData = (await meRes.json()) as {
            ok: boolean;
            result?: { id: number; username?: string; first_name?: string };
          };
          if (meData.ok && meData.result) {
            botUsername = meData.result.username || null;
            botName = meData.result.first_name || null;
          }
        }
      } catch {
        // Silently continue
      }
    }

    res.json({
      ok: true,
      hasToken: Boolean(token),
      botId,
      botUsername,
      botName,
      configuredChatId,
      activeChatId,
      isBotSelfChat,
      hasOverride: Boolean(overrideTelegramChatId),
      latestDetectedUser,
      webhookConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim())
    });
  });

  // Save or Override Telegram Chat ID
  app.post('/api/telegram/chat-id', (req, res) => {
    const rawChatId = req.body?.chatId;
    if (!rawChatId || typeof rawChatId !== 'string' || !rawChatId.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'chatId string is required (e.g. your personal numeric Telegram ID).'
      });
    }

    const cleanChatId = rawChatId.trim();
    const botId = getTelegramBotId();

    if (botId && cleanChatId === botId) {
      return res.status(400).json({
        ok: false,
        isBotSelfChat: true,
        error: `Cannot set Chat ID to ${cleanChatId}. This is the bot's own ID! Telegram bots cannot send messages to themselves. Please enter your personal Telegram user ID (from @userinfobot).`
      });
    }

    overrideTelegramChatId = cleanChatId;
    console.log(`[Telegram Config] Active Chat ID updated to: ${cleanChatId}`);

    res.json({
      ok: true,
      activeChatId: cleanChatId,
      message: `Active Chat ID updated to ${cleanChatId}.`
    });
  });

  // Auto-Detect Telegram Chat ID from recent messages
  app.post('/api/telegram/auto-detect-chat', async (_req, res) => {
    const token = getTelegramToken();
    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'TELEGRAM_BOT_TOKEN is not configured.'
      });
    }

    // 1. Check if we already received an update in memory
    if (latestDetectedUser) {
      overrideTelegramChatId = String(latestDetectedUser.id);
      return res.json({
        ok: true,
        source: 'cached_update',
        detectedUser: latestDetectedUser,
        activeChatId: overrideTelegramChatId,
        message: `Detected Telegram user @${latestDetectedUser.username || latestDetectedUser.firstName || 'user'} (ID: ${latestDetectedUser.id})!`
      });
    }

    // 2. Try fetching getUpdates from Telegram
    try {
      const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5`);
      const updatesData = (await updatesRes.json()) as {
        ok: boolean;
        error_code?: number;
        description?: string;
        result?: Array<{
          message?: {
            from?: { id: number; first_name?: string; username?: string; last_name?: string };
            chat?: { id: number | string };
          };
          callback_query?: {
            from?: { id: number; first_name?: string; username?: string };
          };
        }>;
      };

      if (updatesData.ok && Array.isArray(updatesData.result) && updatesData.result.length > 0) {
        // Find latest user message
        const last = updatesData.result[updatesData.result.length - 1];
        const user = last.message?.from || last.callback_query?.from;
        if (user) {
          latestDetectedUser = {
            id: user.id,
            username: user.username,
            firstName: user.first_name,
            timestamp: new Date().toISOString()
          };
          overrideTelegramChatId = String(user.id);
          return res.json({
            ok: true,
            source: 'telegram_api',
            detectedUser: latestDetectedUser,
            activeChatId: overrideTelegramChatId,
            message: `Detected Telegram user @${user.username || user.first_name || 'user'} (ID: ${user.id})!`
          });
        }
      }

      // If webhook is active, Telegram returns 409 Conflict for getUpdates
      if (updatesData.error_code === 409) {
        return res.json({
          ok: false,
          error:
            'A Telegram webhook is active, so Telegram disabled manual getUpdates polling. Simply send any message (like /start) to your bot in Telegram, then click Auto-Detect again.'
        });
      }

      return res.json({
        ok: false,
        error:
          'No recent messages found. Open your Telegram bot, click Start or send any message, then click Auto-Detect.'
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.json({
        ok: false,
        error: `Failed to query Telegram updates: ${errMsg}`
      });
    }
  });

  // 4. Telegram Bot Alert Endpoint with Inline Interactive Buttons
  app.post('/api/telegram', async (req, res) => {
    const {
      serviceName = 'API Gateway',
      serviceId = 'api',
      severity = 'Critical',
      rootCause = 'Rate-limit token bucket lock contention triggering upstream 504 timeout cascade.',
      proposedFix = 'docker restart api-gateway',
      runbookId = 'RB-204',
      customMessage,
      incidentId,
      isTest = false,
      chatId: clientChatId
    } = req.body as {
      serviceName?: string;
      serviceId?: ServiceId;
      severity?: string;
      rootCause?: string;
      proposedFix?: string;
      runbookId?: string;
      customMessage?: string;
      incidentId?: string;
      isTest?: boolean;
      chatId?: string;
    };

    const alertText =
      customMessage ||
      [
        '🚨 OpsPilot Alert',
        `Service: ${serviceName}`,
        `Severity: ${severity}`,
        `Root cause: ${rootCause}`,
        `Proposed fix: ${proposedFix}`,
        'Open OpsPilot to approve.'
      ].join('\n');

    const token = getTelegramToken();
    const botId = getTelegramBotId();

    if (clientChatId && clientChatId.trim()) {
      overrideTelegramChatId = clientChatId.trim();
    }

    const chatId = clientChatId?.trim() || getTelegramChatId();

    if (!token || !chatId) {
      const errorMsg = !token && !chatId
        ? 'Both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are missing in server environment variables.'
        : !token
        ? 'TELEGRAM_BOT_TOKEN is missing or empty in server environment variables.'
        : 'TELEGRAM_CHAT_ID is missing or empty in server environment variables.';

      console.warn('[Telegram sendMessage] Skipped:', errorMsg);

      return res.status(200).json({
        ok: false,
        deliveredVia: 'fallback-toast',
        error: errorMsg,
        alertText,
        timestamp: new Date().toISOString()
      });
    }

    // Intercept bot-to-bot send attempt before Telegram errors out
    if (botId && chatId === botId) {
      const selfNotice = `Forbidden: the bot can't send messages to the bot. Your TELEGRAM_CHAT_ID (${chatId}) is set to the bot's own ID. Telegram bots cannot message themselves. Please enter your personal Telegram user ID (or send a message to the bot and click 'Auto-detect Chat ID') in Settings.`;
      console.warn('[Telegram sendMessage] Bot self-chat detected:', selfNotice);

      return res.status(200).json({
        ok: false,
        deliveredVia: 'error',
        alertText,
        isBotSelfChat: true,
        botId,
        telegramResponse: {
          ok: false,
          error_code: 403,
          description: "Forbidden: the bot can't send messages to the bot"
        },
        error: selfNotice,
        timestamp: new Date().toISOString()
      });
    }

    // Build payload. Notice: parse_mode is OMITTED as explicitly instructed
    const payload: {
      chat_id: string;
      text: string;
      reply_markup?: {
        inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
      };
    } = {
      chat_id: chatId,
      text: alertText
    };

    // If incidentId is provided (e.g. from Responder agent or test with incidentId), include inline buttons
    const activeId = incidentId || (isTest ? `TEST-${Date.now().toString().slice(-4)}` : undefined);

    if (activeId) {
      payload.reply_markup = {
        inline_keyboard: [
          [
            { text: '✅ Approve Fix', callback_data: `approve:${activeId}` },
            { text: '❌ Decline', callback_data: `decline:${activeId}` }
          ]
        ]
      };

      // Register or update in server memory
      serverIncidents.set(activeId, {
        id: activeId,
        serviceId: (serviceId as ServiceId) || 'api',
        serviceName,
        severity,
        rootCause,
        proposedFix,
        runbookId,
        status: 'pending',
        telegramChatId: chatId
      });
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);

      const tgData = (await tgRes.json()) as {
        ok: boolean;
        result?: { message_id: number; chat?: { id: number | string } };
        description?: string;
        error_code?: number;
      };

      // Log full Telegram API response to server stdout
      console.log(
        `[Telegram API Response: sendMessage] Status: ${tgRes.status}`,
        JSON.stringify(tgData, null, 2)
      );

      if (tgRes.ok && tgData.ok) {
        if (activeId && tgData.result?.message_id) {
          const rec = serverIncidents.get(activeId);
          if (rec) {
            rec.telegramMessageId = tgData.result.message_id;
          }
        }

        return res.json({
          ok: true,
          deliveredVia: 'telegram',
          alertText,
          telegramResponse: tgData,
          messageId: tgData.result?.message_id,
          chatId,
          timestamp: new Date().toISOString()
        });
      } else {
        let errorDesc = tgData.description || `Telegram API error (code: ${tgData.error_code || tgRes.status})`;
        if (errorDesc.includes("can't send messages to the bot")) {
          errorDesc = `Forbidden: the bot can't send messages to the bot (chat ID ${chatId} is the bot's own ID). Enter your personal numeric Chat ID in Settings to receive alerts.`;
        }
        return res.json({
          ok: false,
          deliveredVia: 'error',
          alertText,
          telegramResponse: tgData,
          error: errorDesc,
          chatId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Telegram sendMessage Error]', errMsg);

      return res.json({
        ok: false,
        deliveredVia: 'error',
        alertText,
        error: `Network error connecting to Telegram API: ${errMsg}`,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 5. Connect Telegram Webhook Endpoint
  app.post('/api/telegram/set-webhook', async (req, res) => {
    const token = getTelegramToken();
    if (!token) {
      return res.status(200).json({
        ok: false,
        error: 'TELEGRAM_BOT_TOKEN is not configured in server environment variables.'
      });
    }

    const clientAppUrl = (req.body?.appUrl || '').trim();
    const serverAppUrl = (process.env.APP_URL || '').trim();
    const hostHeader = req.get('host') || 'localhost:3000';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';

    const baseUrl = (
      clientAppUrl ||
      serverAppUrl ||
      `${proto}://${hostHeader}`
    ).replace(/\/+$/, '');

    const webhookUrl = `${baseUrl}/api/telegram/webhook`;
    const secretToken = (process.env.TELEGRAM_WEBHOOK_SECRET || 'opspilot_secret_token').trim();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secretToken,
          allowed_updates: ['message', 'callback_query']
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const tgData = (await tgRes.json()) as {
        ok: boolean;
        result?: boolean;
        description?: string;
        error_code?: number;
      };

      console.log(
        `[Telegram API Response: setWebhook] Status: ${tgRes.status}`,
        JSON.stringify(tgData, null, 2)
      );

      if (tgRes.ok && tgData.ok) {
        return res.json({
          ok: true,
          webhookUrl,
          telegramResponse: tgData,
          description: tgData.description || 'Webhook was set successfully.'
        });
      } else {
        return res.json({
          ok: false,
          webhookUrl,
          telegramResponse: tgData,
          error: tgData.description || `Telegram setWebhook failed (HTTP ${tgRes.status})`
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Telegram setWebhook Error]', errMsg);
      return res.json({
        ok: false,
        webhookUrl,
        error: `Network error calling setWebhook: ${errMsg}`
      });
    }
  });

  // 5. Telegram Webhook Callback Endpoint
  app.post('/api/telegram/webhook', async (req, res) => {
    // Verify secret token header against env TELEGRAM_WEBHOOK_SECRET
    const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
    const configuredSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

    if (configuredSecret && incomingSecret !== configuredSecret) {
      console.warn('[Telegram Webhook] Secret token verification failed.');
      return res.status(403).json({ ok: false, error: 'Unauthorized secret token' });
    }

    const token = getTelegramToken();
    const update = req.body as {
      update_id: number;
      message?: {
        message_id: number;
        from?: { id: number; first_name?: string; username?: string; last_name?: string };
        chat: { id: number | string };
        text?: string;
      };
      callback_query?: {
        id: string;
        from: { id: number; first_name?: string; username?: string };
        message?: {
          message_id: number;
          chat: { id: number | string };
          text?: string;
        };
        data?: string;
      };
    };

    console.log('[Telegram Webhook Received Update]', JSON.stringify(update, null, 2));

    // Automatically record user information from any incoming message
    if (update?.message?.from) {
      const uFrom = update.message.from;
      latestDetectedUser = {
        id: uFrom.id,
        username: uFrom.username,
        firstName: uFrom.first_name,
        timestamp: new Date().toISOString()
      };
      overrideTelegramChatId = String(uFrom.id);
      console.log(`[Telegram Webhook] Automatically detected user @${uFrom.username || uFrom.first_name || 'user'} (ID: ${uFrom.id}) from message.`);

      // Send welcoming acknowledgement
      if (token) {
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: uFrom.id,
            text: `🏛 OpsPilot Control Room Connected!\n\nYour personal Chat ID is ${uFrom.id}.\nOpsPilot will now dispatch incident alerts and interactive approval buttons directly to you.`
          })
        }).catch(() => {});
      }
    }

    const cq = update?.callback_query;
    if (!cq) {
      // Ordinary message or non-callback update
      return res.status(200).json({ ok: true, ignored: true, detectedUser: latestDetectedUser });
    }

    // Capture user from callback query
    if (cq.from) {
      latestDetectedUser = {
        id: cq.from.id,
        username: cq.from.username,
        firstName: cq.from.first_name,
        timestamp: new Date().toISOString()
      };
      overrideTelegramChatId = String(cq.from.id);
    }

    const queryId = cq.id;
    const rawData = cq.data || '';
    const [action, incidentId] = rawData.split(':');
    const message = cq.message;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;

    // 1. Call answerCallbackQuery
    if (token && queryId) {
      try {
        const answerRes = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: queryId,
            text:
              action === 'approve'
                ? '✅ Fix approved! Service remediation initiated.'
                : '❌ Incident fix declined.'
          })
        });
        const answerData = await answerRes.json();
        console.log('[Telegram API Response: answerCallbackQuery]', JSON.stringify(answerData, null, 2));
      } catch (err) {
        console.error('[Telegram answerCallbackQuery Error]', err);
      }
    }

    // 2. Call editMessageText to replace the alert and remove keyboard
    if (token && chatId && messageId) {
      try {
        const originalText = message?.text || '🚨 OpsPilot Incident Alert';
        const updatedText =
          action === 'approve'
            ? `${originalText}\n\n✅ Fix approved, service restored (via Telegram)`
            : `${originalText}\n\n❌ Declined (via Telegram)`;

        const editRes = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: updatedText
            // parse_mode omitted; reply_markup omitted so buttons vanish
          })
        });
        const editData = await editRes.json();
        console.log('[Telegram API Response: editMessageText]', JSON.stringify(editData, null, 2));
      } catch (err) {
        console.error('[Telegram editMessageText Error]', err);
      }
    }

    // 3. Update incident state in server memory
    if (incidentId) {
      const existing = serverIncidents.get(incidentId) || {
        id: incidentId,
        serviceId: 'api',
        serviceName: 'API Gateway',
        severity: 'Critical',
        rootCause: 'Incident',
        proposedFix: 'docker restart api-gateway',
        status: 'pending'
      };

      if (action === 'approve') {
        existing.status = 'resolved';
        existing.approvedBy = 'telegram';
        existing.resolvedAt = new Date().toISOString();
      } else {
        existing.status = 'declined';
        existing.approvedBy = 'telegram';
        existing.declinedAt = new Date().toISOString();
      }

      serverIncidents.set(incidentId, existing);
      console.log(`[Server Incident Memory] ${incidentId} -> status: ${existing.status} (approvedBy: ${existing.approvedBy})`);
    }

    return res.status(200).json({
      ok: true,
      action,
      incidentId
    });
  });

  // 6. Polling endpoint: GET /api/incidents/:id/status
  app.get('/api/incidents/:id/status', (req, res) => {
    const { id } = req.params;
    const incident = serverIncidents.get(id);

    if (!incident) {
      return res.json({
        ok: true,
        incident: {
          id,
          status: 'pending',
          approvedBy: undefined
        }
      });
    }

    res.json({
      ok: true,
      incident
    });
  });

  // 7. Manual in-app resolve / decline update endpoints
  app.post('/api/incidents/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const existing = serverIncidents.get(id) || {
      id,
      serviceId: 'api',
      serviceName: 'API Gateway',
      severity: 'Critical',
      rootCause: 'Incident',
      proposedFix: 'docker restart api-gateway',
      status: 'pending'
    };

    existing.status = 'resolved';
    existing.approvedBy = 'in-app';
    existing.resolvedAt = new Date().toISOString();
    serverIncidents.set(id, existing);

    // Update Telegram message if exists
    const token = getTelegramToken();
    if (token && existing.telegramChatId && existing.telegramMessageId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: existing.telegramChatId,
            message_id: existing.telegramMessageId,
            text: `🚨 OpsPilot Alert for ${existing.serviceName}\n\n✅ Fix approved (via OpsPilot Console), service restored.`
          })
        });
      } catch {
        // Ignore edit failures
      }
    }

    res.json({ ok: true, incident: existing });
  });

  app.post('/api/incidents/:id/decline', async (req, res) => {
    const { id } = req.params;
    const existing = serverIncidents.get(id) || {
      id,
      serviceId: 'api',
      serviceName: 'API Gateway',
      severity: 'Critical',
      rootCause: 'Incident',
      proposedFix: 'docker restart api-gateway',
      status: 'pending'
    };

    existing.status = 'declined';
    existing.approvedBy = 'in-app';
    existing.declinedAt = new Date().toISOString();
    serverIncidents.set(id, existing);

    const token = getTelegramToken();
    if (token && existing.telegramChatId && existing.telegramMessageId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: existing.telegramChatId,
            message_id: existing.telegramMessageId,
            text: `🚨 OpsPilot Alert for ${existing.serviceName}\n\n❌ Declined (via OpsPilot Console).`
          })
        });
      } catch {
        // Ignore edit failures
      }
    }

    res.json({ ok: true, incident: existing });
  });

  // Explicit 404 handler for any unmatched /api/* route (never return HTML for API requests)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found' });
  });

  // Single Node Web Service: Serve static build in production (Render) or Vite middleware in development
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
  }

  // Catch-all route that serves index.html for non-/api paths
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ ok: false, error: 'API endpoint not found' });
    }
    const distPath = path.join(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return next();
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpsPilot server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
