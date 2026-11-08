/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PulseIcon,
  SettingsIcon,
  PlayIcon,
  TerminalIcon,
  ServerIcon,
  DatabaseIcon,
  GlobeIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  HistoryIcon,
  RotateCcwIcon,
  DiamondOrnament,
  CompassIcon,
  CpuIcon
} from './components/icons';
import { AnimatedMenuButton } from './components/AnimatedMenuButton';
import { NavigationDrawer, SectionChunkId, SECTION_CHUNKS } from './components/NavigationDrawer';
import { GoldDivider } from './components/GoldDivider';
import {
  ServiceId,
  ServiceStatus,
  LogEntry,
  LogLevel,
  AgentRole,
  SERVICES_CONFIG,
  AMBIENT_HEALTHY_LOGS,
  INITIAL_INCIDENT_HISTORY,
  IncidentRecord
} from './data/scenarios';
import { AgentPipeline, AgentStepData } from './components/AgentPipeline';
import { SettingsDrawer } from './components/SettingsDrawer';
import { PhoneToast, TelegramToastData } from './components/PhoneToast';
import { MotionVideoBackground } from './components/MotionVideoBackground';

const INITIAL_AGENT_STEPS: AgentStepData[] = [
  {
    role: 'monitor',
    index: 'I',
    name: 'Monitor Agent',
    subtitle: 'Log stream anomaly detection',
    model: 'llama-3.1-8b-instant',
    state: 'idle',
    displayedText: '',
    fullText: ''
  },
  {
    role: 'triage',
    index: 'II',
    name: 'Triage Agent',
    subtitle: 'Severity classification & blast radius',
    model: 'llama-3.1-8b-instant',
    state: 'idle',
    displayedText: '',
    fullText: ''
  },
  {
    role: 'diagnose',
    index: 'III',
    name: 'Diagnose Agent',
    subtitle: 'Root cause analysis & runbook match',
    model: 'llama-3.3-70b-versatile',
    state: 'idle',
    displayedText: '',
    fullText: ''
  },
  {
    role: 'responder',
    index: 'IV',
    name: 'Responder Agent',
    subtitle: 'Incident synthesis & Telegram dispatch',
    model: 'llama-3.3-70b-versatile',
    state: 'idle',
    displayedText: '',
    fullText: ''
  }
];

function formatClock(date: Date): string {
  return date.toTimeString().split(' ')[0];
}

function createInitialLogs(): LogEntry[] {
  const now = Date.now();
  return AMBIENT_HEALTHY_LOGS.slice(0, 5).map((item, idx) => ({
    id: `init-${idx}`,
    timestamp: formatClock(new Date(now - (5 - idx) * 3000)),
    service: item.service,
    level: item.level,
    message: item.message
  }));
}

export default function App() {
  // Live clock
  const [currentTime, setCurrentTime] = useState<string>(() => formatClock(new Date()));

  // Active Section Chunk State ('all' | 'topology' | 'telemetry' | 'pipeline' | 'history')
  const [activeSection, setActiveSection] = useState<SectionChunkId>('all');
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);

  // Services state
  const [serviceStatuses, setServiceStatuses] = useState<Record<ServiceId, ServiceStatus>>({
    web: 'healthy',
    api: 'healthy',
    database: 'healthy'
  });

  const [serviceLatencies, setServiceLatencies] = useState<Record<ServiceId, number>>({
    web: 26,
    api: 17,
    database: 6
  });

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>(createInitialLogs);
  const [logFilter, setLogFilter] = useState<'all' | 'errors'>('all');
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Active Incident & Pipeline state
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);
  const [approvedBy, setApprovedBy] = useState<'telegram' | 'in-app' | undefined>(undefined);
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<
    'idle' | 'running' | 'awaiting_approval' | 'executing_fix' | 'resolved' | 'acknowledged'
  >('idle');
  const [agentSteps, setAgentSteps] = useState<AgentStepData[]>(INITIAL_AGENT_STEPS);
  const [incidentStartTimeMs, setIncidentStartTimeMs] = useState<number | null>(null);
  const [resolutionTimeSec, setResolutionTimeSec] = useState<number | null>(null);
  const [executionProgress, setExecutionProgress] = useState<number>(0);
  const [executionStageText, setExecutionStageText] = useState<string>('Initializing fix...');

  // History state
  const [incidentHistory, setIncidentHistory] = useState<IncidentRecord[]>(INITIAL_INCIDENT_HISTORY);

  // Settings & Server Connectivity state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(true);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState<boolean>(false);
  const [groqConnected, setGroqConnected] = useState<boolean>(false);
  const [telegramConnected, setTelegramConnected] = useState<boolean>(false);

  // Phone-style Toast notification
  const [activeToast, setActiveToast] = useState<TelegramToastData | null>(null);

  // Refs for cancellation & scrolling
  const runIdRef = useRef<number>(0);
  const demoRotationRef = useRef<number>(0);
  const approvalCardRef = useRef<HTMLDivElement | null>(null);
  const pipelineSectionRef = useRef<HTMLDivElement | null>(null);

  const anyIncidentActive =
    serviceStatuses.web !== 'healthy' ||
    serviceStatuses.api !== 'healthy' ||
    serviceStatuses.database !== 'healthy';

  // 1. Live Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatClock(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Check Server Health Probe on Mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setGroqConnected(Boolean(data.groq));
          setTelegramConnected(Boolean(data.telegram));
        }
      })
      .catch(() => {
        setGroqConnected(false);
        setTelegramConnected(false);
      });
  }, []);

  // 3. Realistic Latency Fluctuation
  useEffect(() => {
    const timer = setInterval(() => {
      setServiceLatencies((prev) => {
        const next: Record<ServiceId, number> = { ...prev };
        (['web', 'api', 'database'] as ServiceId[]).forEach((id) => {
          const cfg = SERVICES_CONFIG[id];
          const status = serviceStatuses[id];
          if (status === 'healthy') {
            const [min, max] = cfg.baseLatencyRange;
            const delta = Math.floor(Math.random() * 5) - 2;
            const candidate = prev[id] + delta;
            next[id] = Math.max(min, Math.min(max, candidate));
          } else {
            const [min, max] = cfg.failingLatencyRange;
            next[id] = Math.floor(min + Math.random() * (max - min));
          }
        });
        return next;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [serviceStatuses]);

  // 4. Ambient Log Generator while systems are operational
  useEffect(() => {
    const timer = setInterval(() => {
      if (pipelineStatus === 'running') return;
      const sample =
        AMBIENT_HEALTHY_LOGS[Math.floor(Math.random() * AMBIENT_HEALTHY_LOGS.length)];
      setLogs((prev) => [
        ...prev.slice(-75),
        {
          id: `amb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: formatClock(new Date()),
          service: sample.service,
          level: sample.level,
          message: sample.message
        }
      ]);
    }, 3800);
    return () => clearInterval(timer);
  }, [pipelineStatus]);

  // Auto-scroll terminal log stream
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs, logFilter]);

  const appendLog = useCallback((service: string, level: LogLevel, message: string) => {
    setLogs((prev) => [
      ...prev.slice(-85),
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: formatClock(new Date()),
        service,
        level,
        message
      }
    ]);
  }, []);

  // Typewriter effect for single agent step
  const animateAgentText = useCallback(
    (role: AgentRole, fullText: string, durationMs: number, currentRunId: number): Promise<void> => {
      return new Promise((resolve) => {
        setAgentSteps((prev) =>
          prev.map((step) =>
            step.role === role
              ? { ...step, state: 'typing', fullText, displayedText: '', durationMs }
              : step
          )
        );

        let charIndex = 0;
        const stepSize = 3;
        const interval = setInterval(() => {
          if (runIdRef.current !== currentRunId) {
            clearInterval(interval);
            resolve();
            return;
          }
          charIndex = Math.min(fullText.length, charIndex + stepSize);
          const sliced = fullText.slice(0, charIndex);

          setAgentSteps((prev) =>
            prev.map((step) =>
              step.role === role
                ? {
                    ...step,
                    displayedText: sliced,
                    state: charIndex >= fullText.length ? 'done' : 'typing'
                  }
                : step
            )
          );

          if (charIndex >= fullText.length) {
            clearInterval(interval);
            resolve();
          }
        }, 18);
      });
    },
    []
  );

  // Send Telegram Alert via server /api/telegram with incidentId & inline buttons
  const dispatchTelegramAlert = useCallback(
    async (serviceId: ServiceId, incidentId: string) => {
      const cfg = SERVICES_CONFIG[serviceId];
      const exactAlertMessage = [
        '🚨 OpsPilot Alert',
        `Service: ${cfg.name}`,
        `Severity: ${cfg.severity}`,
        `Root cause: ${cfg.rootCauseShort}`,
        `Proposed fix: ${cfg.fixCommand}`,
        'Select an action below or open OpsPilot to approve.'
      ].join('\n');

      if (!telegramEnabled) {
        appendLog('opspilot-responder', 'INFO', 'Telegram alerts muted in Settings; awaiting in-app approval.');
        return;
      }

      try {
        const customChatId = localStorage.getItem('opspilot_custom_chat_id');
        const res = await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incidentId,
            serviceId: cfg.id,
            serviceName: cfg.name,
            severity: cfg.severity,
            rootCause: cfg.rootCauseShort,
            proposedFix: cfg.fixCommand,
            runbookId: cfg.runbookId,
            customMessage: exactAlertMessage,
            chatId: customChatId || undefined
          })
        });
        const data = await res.json();

        if (data.ok && data.deliveredVia === 'telegram') {
          appendLog(
            'opspilot-responder',
            'INFO',
            `Telegram incident alert dispatched to chat ${data.chatId || ''} (message ID: ${data.messageId || 'ok'}).`
          );
        } else if (data.isBotSelfChat) {
          appendLog(
            'opspilot-responder',
            'WARN',
            `Telegram notice: destination Chat ID is set to Bot ID (${data.botId}). Open Settings to link your personal user ID.`
          );
        } else if (data.error) {
          appendLog(
            'opspilot-responder',
            'WARN',
            `Telegram delivery status: ${data.error}`
          );
        }

        setActiveToast({
          id: `tg-${Date.now()}`,
          type: 'telegram',
          title: 'Telegram · OpsPilot Bot',
          subtitle: `Incident Alert · ${cfg.name}`,
          body: data.alertText || exactAlertMessage,
          deliveredVia: data.deliveredVia || 'fallback-toast',
          timestamp: formatClock(new Date())
        });
      } catch {
        setActiveToast({
          id: `tg-${Date.now()}`,
          type: 'telegram',
          title: 'Telegram · OpsPilot Bot',
          subtitle: `Incident Alert · ${cfg.name}`,
          body: exactAlertMessage,
          deliveredVia: 'fallback-toast',
          timestamp: formatClock(new Date())
        });
      }
    },
    [telegramEnabled, appendLog]
  );

  // Trigger a failure scenario on a specific service and run the 4-agent pipeline
  const triggerIncident = useCallback(
    async (serviceId: ServiceId) => {
      const currentRunId = ++runIdRef.current;
      const cfg = SERVICES_CONFIG[serviceId];
      const startTime = Date.now();
      const incidentId = `INC-${Math.floor(8500 + Math.random() * 499)}`;

      setIncidentStartTimeMs(startTime);
      setResolutionTimeSec(null);
      setCurrentIncidentId(incidentId);
      setApprovedBy(undefined);
      setActiveServiceId(serviceId);
      setPipelineStatus('running');
      setLogFilter('all');

      setServiceStatuses({
        web: serviceId === 'web' ? 'failing' : 'healthy',
        api: serviceId === 'api' ? 'failing' : 'healthy',
        database: serviceId === 'database' ? 'failing' : 'healthy'
      });

      setServiceLatencies((prev) => ({
        ...prev,
        [serviceId]: cfg.failingLatencyRange[0] + 240
      }));

      setAgentSteps(
        INITIAL_AGENT_STEPS.map((s) => ({
          ...s,
          state: 'idle',
          displayedText: '',
          fullText: '',
          durationMs: undefined
        }))
      );

      // Auto-switch to pipeline chunk if user is currently on an isolated chunk
      setActiveSection((prev) => (prev === 'topology' || prev === 'telemetry' || prev === 'history' ? 'pipeline' : prev));

      setTimeout(() => {
        pipelineSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);

      const logLinesStrings: string[] = [];
      for (let i = 0; i < cfg.errorLogs.length; i++) {
        if (runIdRef.current !== currentRunId) return;
        const entry = cfg.errorLogs[i];
        logLinesStrings.push(`${entry.level}: ${entry.message}`);
        appendLog(cfg.id, entry.level, entry.message);
        await new Promise((r) => setTimeout(r, 110));
      }

      const rolesOrder: AgentRole[] = ['monitor', 'triage', 'diagnose', 'responder'];
      const accumulatedOutputs: Partial<Record<AgentRole, string>> = {};

      for (const role of rolesOrder) {
        if (runIdRef.current !== currentRunId) return;

        setAgentSteps((prev) =>
          prev.map((step) => (step.role === role ? { ...step, state: 'thinking' } : step))
        );

        const stepStart = Date.now();
        let agentOutputText = cfg.fallbackAgentOutputs[role];
        let serverLatencyMs: number | undefined;

        try {
          const [res] = await Promise.all([
            fetch('/api/agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agentRole: role,
                serviceId: cfg.id,
                serviceName: cfg.name,
                scenarioTitle: cfg.failureScenarioTitle,
                logs: logLinesStrings,
                previousOutputs: accumulatedOutputs
              })
            }),
            new Promise((r) => setTimeout(r, 400))
          ]);

          if (res.ok) {
            const data = await res.json();
            if (data?.output && typeof data.output === 'string') {
              agentOutputText = data.output;
            }
            if (typeof data?.latencyMs === 'number') {
              serverLatencyMs = data.latencyMs;
            }
            if (data?.model && typeof data.model === 'string') {
              setAgentSteps((prev) =>
                prev.map((step) =>
                  step.role === role ? { ...step, model: data.model } : step
                )
              );
            }
          }
        } catch {
          await new Promise((r) => setTimeout(r, 400));
        }

        if (runIdRef.current !== currentRunId) return;

        accumulatedOutputs[role] = agentOutputText;
        const stepDuration = serverLatencyMs ?? (Date.now() - stepStart);

        await animateAgentText(role, agentOutputText, stepDuration, currentRunId);
      }

      if (runIdRef.current !== currentRunId) return;

      appendLog(
        'opspilot-responder',
        'WARN',
        `Incident staged (${cfg.runbookId}): awaiting engineer approval for "${cfg.fixCommand}"`
      );
      await dispatchTelegramAlert(serviceId, incidentId);

      if (runIdRef.current !== currentRunId) return;
      setPipelineStatus('awaiting_approval');
    },
    [appendLog, animateAgentText, dispatchTelegramAlert]
  );

  const handleRunLiveDemo = useCallback(() => {
    setActiveSection((prev) => (prev === 'topology' || prev === 'telemetry' || prev === 'history' ? 'pipeline' : prev));
    const order: ServiceId[] = ['api', 'web', 'database'];
    const nextService = order[demoRotationRef.current % order.length];
    demoRotationRef.current += 1;
    triggerIncident(nextService);
  }, [triggerIncident]);

  const handleApproveFix = useCallback(
    async (by: 'telegram' | 'in-app' = 'in-app') => {
      if (!activeServiceId || (pipelineStatus !== 'awaiting_approval' && pipelineStatus !== 'running')) return;
      const cfg = SERVICES_CONFIG[activeServiceId];
      const currentRunId = runIdRef.current;
      const incidentId = currentIncidentId || `INC-${Math.floor(8500 + Math.random() * 499)}`;

      setApprovedBy(by);
      setPipelineStatus('executing_fix');
      setExecutionProgress(15);
      setExecutionStageText(
        by === 'telegram'
          ? `Approved via Telegram: Executing ${cfg.fixCommand}...`
          : `Executing: ${cfg.fixCommand}...`
      );

      // Notify server memory if approved in-app
      if (by === 'in-app' && currentIncidentId) {
        fetch(`/api/incidents/${currentIncidentId}/resolve`, { method: 'POST' }).catch(() => {});
      }

      const stages = [
        { progress: 42, text: by === 'telegram' ? 'Approved via Telegram: Draining worker sockets...' : 'Draining stalled worker sockets...' },
        { progress: 74, text: 'Restarting container & reloading pool...' },
        { progress: 96, text: 'Running synthetic readiness probes...' }
      ];

      for (let i = 0; i < stages.length; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (runIdRef.current !== currentRunId) return;
        setExecutionProgress(stages[i].progress);
        setExecutionStageText(stages[i].text);
        if (cfg.recoveryLogs[i]) {
          appendLog(cfg.id, cfg.recoveryLogs[i].level, cfg.recoveryLogs[i].message);
        }
      }

      await new Promise((r) => setTimeout(r, 400));
      if (runIdRef.current !== currentRunId) return;

      if (cfg.recoveryLogs[3]) {
        appendLog(cfg.id, cfg.recoveryLogs[3].level, cfg.recoveryLogs[3].message);
      }

      setExecutionProgress(100);

      const elapsedSec = incidentStartTimeMs
        ? Math.max(12, Math.round((Date.now() - incidentStartTimeMs) / 1000))
        : 28;

      setResolutionTimeSec(elapsedSec);
      setPipelineStatus('resolved');

      setServiceStatuses((prev) => ({
        ...prev,
        [activeServiceId]: 'healthy'
      }));
      setServiceLatencies((prev) => ({
        ...prev,
        [activeServiceId]: cfg.baseLatencyRange[0] + 2
      }));

      const newRecord: IncidentRecord = {
        id: incidentId,
        timestamp: `Just now · ${formatClock(new Date())}`,
        serviceId: activeServiceId,
        serviceName: cfg.name,
        severity: cfg.severity,
        rootCause: `${cfg.rootCauseShort}${by === 'telegram' ? ' (Approved via Telegram)' : ''}`,
        proposedFix: cfg.fixCommand,
        runbookId: cfg.runbookId,
        status: 'Resolved',
        resolutionSeconds: elapsedSec,
        autoDiagnosed: true
      };
      setIncidentHistory((prev) => [newRecord, ...prev]);

      setActiveToast({
        id: `res-${Date.now()}`,
        type: 'resolved',
        title: by === 'telegram' ? 'Remediation Verified · via Telegram' : 'Remediation Verified',
        subtitle: `${cfg.name} · ${by === 'telegram' ? 'Approved via Telegram · ' : ''}Resolved in ${elapsedSec}s`,
        body: `Executed "${cfg.fixCommand}" (${cfg.runbookId}) after ${by === 'telegram' ? 'approval via Telegram interactive buttons' : 'in-app approval'}. Readiness probes returned 200 OK and latency normalized to ${cfg.baseLatencyRange[0] + 2}ms.`,
        timestamp: formatClock(new Date())
      });
    },
    [activeServiceId, pipelineStatus, incidentStartTimeMs, currentIncidentId, appendLog]
  );

  const handleQuickRestoreService = useCallback(
    (serviceId: ServiceId) => {
      const cfg = SERVICES_CONFIG[serviceId];
      appendLog(
        cfg.id,
        'INFO',
        `[opspilot-exec] Executed immediate recovery for ${cfg.name}: ${cfg.fixCommand}. Upstream sockets re-initialized.`
      );
      setServiceStatuses((prev) => ({
        ...prev,
        [serviceId]: 'healthy'
      }));
      setServiceLatencies((prev) => ({
        ...prev,
        [serviceId]: cfg.baseLatencyRange[0] + 2
      }));
      if (activeServiceId === serviceId) {
        setPipelineStatus('resolved');
        setResolutionTimeSec(12);
      }
      setActiveToast({
        id: `rst-${Date.now()}`,
        type: 'resolved',
        title: `${cfg.name} Restored to Nominal`,
        subtitle: `Executed: ${cfg.fixCommand}`,
        body: `${cfg.name} has been restored to 100% nominal operation (latency normalized to ${cfg.baseLatencyRange[0] + 2}ms).`,
        timestamp: formatClock(new Date())
      });
    },
    [activeServiceId, appendLog]
  );

  const handleRestoreAllServices = useCallback(() => {
    runIdRef.current += 1;
    setServiceStatuses({
      web: 'healthy',
      api: 'healthy',
      database: 'healthy'
    });
    setServiceLatencies({
      web: 26,
      api: 17,
      database: 6
    });
    setPipelineStatus('idle');
    setActiveServiceId(null);
    setCurrentIncidentId(null);
    setAgentSteps(INITIAL_AGENT_STEPS);
    appendLog('opspilot-responder', 'INFO', 'Manual override: All services restored to healthy nominal operation.');
    setActiveToast({
      id: `rst-all-${Date.now()}`,
      type: 'resolved',
      title: 'All Services Restored',
      subtitle: 'Production Topology Nominal',
      body: 'All monitored services have been reset to 100% healthy status with nominal latencies.',
      timestamp: formatClock(new Date())
    });
  }, [appendLog]);

  const handleIgnoreIncident = useCallback(
    (by: 'telegram' | 'in-app' = 'in-app') => {
      if (!activeServiceId || pipelineStatus !== 'awaiting_approval') return;
      const cfg = SERVICES_CONFIG[activeServiceId];
      const elapsedSec = incidentStartTimeMs
        ? Math.max(10, Math.round((Date.now() - incidentStartTimeMs) / 1000))
        : 24;
      const incidentId = currentIncidentId || `INC-${Math.floor(8500 + Math.random() * 499)}`;

      setApprovedBy(by);
      setPipelineStatus('acknowledged');

      if (by === 'in-app' && currentIncidentId) {
        fetch(`/api/incidents/${currentIncidentId}/decline`, { method: 'POST' }).catch(() => {});
      }

      appendLog(
        'opspilot-responder',
        'WARN',
        `Engineer acknowledged ${cfg.name} incident without automated fix (${by === 'telegram' ? 'via Telegram' : 'in console'}); service remains degraded.`
      );

      const newRecord: IncidentRecord = {
        id: incidentId,
        timestamp: `Just now · ${formatClock(new Date())}`,
        serviceId: activeServiceId,
        serviceName: cfg.name,
        severity: cfg.severity,
        rootCause: `${cfg.rootCauseShort}${by === 'telegram' ? ' (Declined via Telegram)' : ''}`,
        proposedFix: cfg.fixCommand,
        runbookId: cfg.runbookId,
        status: 'Acknowledged',
        resolutionSeconds: elapsedSec,
        autoDiagnosed: true
      };
      setIncidentHistory((prev) => [newRecord, ...prev]);

      setActiveToast({
        id: `ack-${Date.now()}`,
        type: 'acknowledged',
        title: by === 'telegram' ? 'Incident Declined · via Telegram' : 'Incident Acknowledged',
        subtitle: `${cfg.name} · Manual Investigation`,
        body: `Automated fix "${cfg.fixCommand}" was deferred ${by === 'telegram' ? 'via Telegram inline button' : 'by engineer'}. ${cfg.name} remains in failing state.`,
        timestamp: formatClock(new Date())
      });
    },
    [activeServiceId, pipelineStatus, incidentStartTimeMs, currentIncidentId, appendLog]
  );

  // 5. Poll GET /api/incidents/:id/status every 1 second when awaiting approval
  useEffect(() => {
    if (pipelineStatus !== 'awaiting_approval' || !currentIncidentId) return;

    let isPolling = true;

    const timer = setInterval(async () => {
      if (!isPolling) return;
      try {
        const res = await fetch(`/api/incidents/${currentIncidentId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.incident?.status === 'resolved' && data.incident.approvedBy === 'telegram') {
          isPolling = false;
          handleApproveFix('telegram');
        } else if (data?.incident?.status === 'declined' && data.incident.approvedBy === 'telegram') {
          isPolling = false;
          handleIgnoreIncident('telegram');
        }
      } catch {
        // Ignore transient poll failures
      }
    }, 1000);

    return () => {
      isPolling = false;
      clearInterval(timer);
    };
  }, [pipelineStatus, currentIncidentId, handleApproveFix, handleIgnoreIncident]);

  const handleSendTestAlert = useCallback(async () => {
    setIsSendingTestAlert(true);
    const testMessage = [
      '🚨 OpsPilot Alert',
      'Service: API Gateway (Synthetic Test)',
      'Severity: High',
      'Root cause: Manual webhook verification triggered from Control Room Settings.',
      'Proposed fix: docker restart api-gateway',
      'Open OpsPilot to approve.'
    ].join('\n');

    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customMessage: testMessage })
      });
      const data = await res.json();
      setActiveToast({
        id: `test-${Date.now()}`,
        type: 'telegram',
        title: 'Telegram · Test Alert',
        subtitle: 'Webhook Verification',
        body: data.alertText || testMessage,
        deliveredVia: data.deliveredVia || 'fallback-toast',
        timestamp: formatClock(new Date())
      });
    } catch {
      setActiveToast({
        id: `test-${Date.now()}`,
        type: 'telegram',
        title: 'Telegram · Test Alert',
        subtitle: 'Webhook Verification',
        body: testMessage,
        deliveredVia: 'fallback-toast',
        timestamp: formatClock(new Date())
      });
    } finally {
      setIsSendingTestAlert(false);
    }
  }, []);

  const displayedLogs =
    logFilter === 'errors'
      ? logs.filter((l) => l.level === 'WARN' || l.level === 'ERROR')
      : logs;

  const totalIncidents = incidentHistory.length;
  const resolvedIncidents = incidentHistory.filter((i) => i.status === 'Resolved');
  const avgResolutionSec =
    resolvedIncidents.length > 0
      ? Math.round(
          resolvedIncidents.reduce((acc, item) => acc + item.resolutionSeconds, 0) /
            resolvedIncidents.length
        )
      : 0;
  const autoDiagnosedPct =
    totalIncidents > 0
      ? Math.round(
          (incidentHistory.filter((i) => i.autoDiagnosed).length / totalIncidents) * 100
        )
      : 100;

  const getServiceIcon = (id: ServiceId) => {
    switch (id) {
      case 'web':
        return <GlobeIcon className="w-4 h-4 text-[#c9a45c]" />;
      case 'api':
        return <ServerIcon className="w-4 h-4 text-[#c9a45c]" />;
      case 'database':
        return <DatabaseIcon className="w-4 h-4 text-[#c9a45c]" />;
    }
  };

  const currentChunkConfig = SECTION_CHUNKS.find((c) => c.id === activeSection);

  // Render Topology Section Chunk
  const renderTopologyChunk = () => (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium flex items-center gap-1.5">
            <DiamondOrnament className="w-2 h-2 text-[#c9a45c]" />
            <span>Production Topology</span>
          </p>
          <h2 className="text-xl font-editorial font-semibold text-[#ece6d8] mt-1">
            Monitored Services
          </h2>
        </div>
        <span className="text-xs font-mono text-[#8f8a7e] md:hidden">
          {currentTime}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['web', 'api', 'database'] as ServiceId[]).map((id) => {
          const cfg = SERVICES_CONFIG[id];
          const status = serviceStatuses[id];
          const isFailing = status === 'failing';
          const latency = serviceLatencies[id];
          const uptime = isFailing ? cfg.failingUptime : cfg.baseUptime;

          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 ${
                isFailing ? 'certificate-card-failing' : 'certificate-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0b0f17] border border-[#c9a45c]/14 flex items-center justify-center">
                    {getServiceIcon(id)}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="relative flex h-2 w-2">
                      {isFailing && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c4605a] opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          isFailing
                            ? 'bg-[#c4605a] shadow-[0_0_8px_rgba(196,96,90,0.85)]'
                            : 'bg-[#7fb89a] shadow-[0_0_8px_rgba(127,184,154,0.7)]'
                        }`}
                      />
                    </span>
                    <span
                      className={`text-[11px] font-mono tracking-wider ${
                        isFailing ? 'text-[#c4605a] font-medium' : 'text-[#7fb89a]'
                      }`}
                    >
                      {isFailing ? 'Failing' : 'Healthy'}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-base font-editorial font-semibold text-[#ece6d8]">
                    {cfg.name}
                  </h3>
                  <p className="text-[11px] font-mono text-[#8f8a7e] mt-0.5">
                    {cfg.cluster}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#c9a45c]/12 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.16em] text-[#8f8a7e]">
                      Uptime
                    </p>
                    <p
                      className={`text-sm font-mono font-medium mt-0.5 ${
                        isFailing ? 'text-[#d9a441]' : 'text-[#ece6d8]'
                      }`}
                    >
                      {uptime.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.16em] text-[#8f8a7e]">
                      Latency
                    </p>
                    <p
                      className={`text-sm font-mono font-medium mt-0.5 ${
                        isFailing ? 'text-[#c4605a]' : 'text-[#7fb89a]'
                      }`}
                    >
                      {latency} ms
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-[#8f8a7e] font-light line-clamp-2 min-h-[32px]">
                  {isFailing ? (
                    <span className="text-[#c4605a]">
                      Alert: {cfg.failureScenarioTitle}
                    </span>
                  ) : (
                    <span>Scenario: {cfg.failureScenarioTitle}</span>
                  )}
                </p>
              </div>

              {isFailing ? (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (pipelineStatus === 'awaiting_approval' && activeServiceId === id) {
                        handleApproveFix('in-app');
                      } else {
                        handleQuickRestoreService(id);
                      }
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#c9a45c] hover:bg-[#e6c98a] text-[#0b0f17] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-[0_4px_16px_rgba(201,164,92,0.25)]"
                  >
                    <CheckCircleIcon className="w-3.5 h-3.5 text-[#0b0f17]" />
                    <span>Approve &amp; Restore Fix</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection('pipeline');
                        setTimeout(() => {
                          pipelineSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }}
                      className="min-h-[36px] px-2 py-1.5 rounded-lg text-[11px] font-medium border border-[#c9a45c]/30 hover:border-[#c9a45c]/60 text-[#ece6d8] hover:bg-white/[0.04] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>View Pipeline</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerIncident(id)}
                      disabled={pipelineStatus === 'running' || pipelineStatus === 'executing_fix'}
                      className="min-h-[36px] px-2 py-1.5 rounded-lg text-[11px] font-medium border border-[#c4605a]/30 hover:border-[#c4605a]/60 text-[#fca5a5] hover:bg-[#c4605a]/10 flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcwIcon className="w-3 h-3" />
                      <span>Re-Run</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    triggerIncident(id);
                  }}
                  disabled={pipelineStatus === 'running' || pipelineStatus === 'executing_fix'}
                  className="mt-4 w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap bg-white/[0.03] hover:bg-[#c9a45c]/10 border border-[#c9a45c]/15 text-[#ece6d8]"
                >
                  <AlertTriangleIcon className="w-3.5 h-3.5 text-[#d9a441]" />
                  <span>Simulate Failure</span>
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );

  // Render Telemetry Chunk
  const renderTelemetryChunk = (isExpandedFull = false) => (
    <section className="certificate-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[#c9a45c]/14 flex flex-wrap items-center justify-between gap-3 bg-[#0b0f17]/40">
        <div className="flex items-center gap-2.5">
          <TerminalIcon className="w-4 h-4 text-[#c9a45c]" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium flex items-center gap-1.5">
              <DiamondOrnament className="w-2 h-2 text-[#c9a45c]" />
              <span>Real-Time Telemetry Stream</span>
            </p>
            <h2 className="text-base font-editorial font-semibold text-[#ece6d8]">
              Live Server Logs
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#0b0f17] p-1 rounded-xl border border-[#c9a45c]/15">
          <button
            type="button"
            onClick={() => setLogFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              logFilter === 'all'
                ? 'bg-[#192131] text-[#ece6d8] shadow-sm'
                : 'text-[#8f8a7e] hover:text-[#ece6d8]'
            }`}
          >
            All ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setLogFilter('errors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              logFilter === 'errors'
                ? 'bg-[#c4605a]/20 text-[#c4605a] border border-[#c4605a]/30'
                : 'text-[#8f8a7e] hover:text-[#ece6d8]'
            }`}
          >
            Warn &amp; Error (
            {logs.filter((l) => l.level === 'WARN' || l.level === 'ERROR').length})
          </button>
        </div>
      </div>

      <div
        ref={logContainerRef}
        className={`${
          isExpandedFull ? 'h-[500px]' : 'h-[340px] sm:h-[380px]'
        } overflow-y-auto p-4 bg-[#080b11] font-mono text-xs space-y-2`}
      >
        {displayedLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#8f8a7e] space-y-2">
            <CheckCircleIcon className="w-5 h-5 text-[#7fb89a]/70" />
            <p className="font-serif italic text-sm text-[#ece6d8]">No errors or anomalies recorded.</p>
            <p className="text-xs text-[#8f8a7e]">All monitored endpoints operating within nominal latency thresholds.</p>
          </div>
        ) : (
          displayedLogs.map((entry) => {
            const levelColor =
              entry.level === 'ERROR'
                ? 'text-[#c4605a]'
                : entry.level === 'WARN'
                ? 'text-[#d9a441]'
                : 'text-[#8f8a7e]';

            return (
              <div
                key={entry.id}
                className={`flex items-start gap-2.5 leading-relaxed py-0.5 px-2 rounded ${
                  entry.level === 'ERROR'
                    ? 'bg-[#c4605a]/[0.08]'
                    : entry.level === 'WARN'
                    ? 'bg-[#d9a441]/[0.06]'
                    : ''
                }`}
              >
                <span className="text-[#8f8a7e] shrink-0 select-none">
                  {entry.timestamp}
                </span>
                <span className={`font-medium w-12 shrink-0 ${levelColor}`}>
                  {entry.level}
                </span>
                <span className="text-[#c9a45c]/85 shrink-0 hidden sm:inline">
                  [{entry.service}]
                </span>
                <span
                  className={`break-words ${
                    entry.level === 'ERROR'
                      ? 'text-red-200'
                      : entry.level === 'WARN'
                      ? 'text-amber-100'
                      : 'text-[#ece6d8]/90'
                  }`}
                >
                  {entry.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );

  // Render Pipeline Chunk
  const renderPipelineChunk = () => (
    <div ref={pipelineSectionRef} className="w-full">
      <AgentPipeline
        steps={agentSteps}
        activeService={activeServiceId ? SERVICES_CONFIG[activeServiceId] : null}
        pipelineStatus={pipelineStatus}
        executionProgress={executionProgress}
        executionStageText={executionStageText}
        resolutionTimeSec={resolutionTimeSec}
        approvedBy={approvedBy}
        onApproveFix={handleApproveFix}
        onIgnoreIncident={handleIgnoreIncident}
        onRunLiveDemo={handleRunLiveDemo}
        approvalCardRef={approvalCardRef}
      />
    </div>
  );

  // Render History Chunk
  const renderHistoryChunk = () => (
    <section className="certificate-card p-5 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#c9a45c]/14 pb-4">
        <div className="flex items-center gap-2.5">
          <HistoryIcon className="w-4 h-4 text-[#c9a45c]" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium flex items-center gap-1.5">
              <DiamondOrnament className="w-2 h-2 text-[#c9a45c]" />
              <span>Session Audit Ledger</span>
            </p>
            <h2 className="text-xl font-editorial font-semibold text-[#ece6d8] mt-1">
              Incident History
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#8f8a7e]">
              Total Incidents
            </p>
            <p className="text-lg font-mono font-semibold text-[#ece6d8] mt-0.5">
              {totalIncidents}
            </p>
          </div>
          <div className="border-l border-[#c9a45c]/15 pl-6">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#8f8a7e]">
              Avg Resolution Time
            </p>
            <p className="text-lg font-mono font-semibold text-[#7fb89a] mt-0.5">
              {avgResolutionSec > 0 ? `${avgResolutionSec}s` : '—'}
            </p>
          </div>
          <div className="border-l border-[#c9a45c]/15 pl-6">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#8f8a7e]">
              Auto-Diagnosed
            </p>
            <p className="text-lg font-mono font-semibold text-[#c9a45c] mt-0.5">
              {autoDiagnosedPct}%
            </p>
          </div>
        </div>
      </div>

      {incidentHistory.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <p className="font-editorial italic text-base text-[#ece6d8]">No incidents recorded in this session.</p>
          <p className="text-xs text-[#8f8a7e]">
            Simulate a service failure or click &ldquo;Run Live Demo&rdquo; to log an incident.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#c9a45c]/10">
          {incidentHistory.map((incident) => (
            <div
              key={incident.id}
              className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="space-y-1 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-[#c9a45c]">
                    {incident.id}
                  </span>
                  <span className="text-[#c9a45c]/40" aria-hidden="true">·</span>
                  <span className="font-serif font-medium text-[#ece6d8]">{incident.serviceName}</span>
                  <span className="text-[#c9a45c]/40" aria-hidden="true">·</span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded border ${
                      incident.severity === 'Critical'
                        ? 'border-[#c4605a]/40 text-[#c4605a]'
                        : incident.severity === 'High'
                        ? 'border-[#d9a441]/40 text-[#d9a441]'
                        : 'border-[#7fb89a]/40 text-[#7fb89a]'
                    }`}
                  >
                    {incident.severity}
                  </span>
                  <span className="text-[#c9a45c]/40" aria-hidden="true">·</span>
                  <span className="font-mono text-[#8f8a7e]">{incident.timestamp}</span>
                </div>

                <p className="text-sm text-[#ece6d8]/90 font-light">{incident.rootCause}</p>

                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs font-mono text-[#8f8a7e]">
                  <span>Runbook {incident.runbookId}</span>
                  <span className="text-[#c9a45c]/40" aria-hidden="true">/</span>
                  <code className="text-[#7fb89a]">{incident.proposedFix}</code>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-xs font-mono">
                {incident.status === 'Resolved' ? (
                  <div className="flex items-center gap-2 text-[#7fb89a]">
                    <CheckCircleIcon className="w-4 h-4 text-[#7fb89a]" />
                    <span>Resolved in {incident.resolutionSeconds}s</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#d9a441]">
                    <AlertTriangleIcon className="w-4 h-4 text-[#d9a441]" />
                    <span>Acknowledged ({incident.resolutionSeconds}s)</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-transparent text-[#ece6d8] relative flex flex-col justify-between selection:bg-[#c9a45c]/25 selection:text-[#f7e8c3]">
      {/* 3D Kinetic Alabaster Torus Video Background */}
      <MotionVideoBackground anyIncidentActive={anyIncidentActive} />

      {/* Subtle warm radial glow behind the header */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[980px] h-[360px] rounded-full opacity-20 blur-[130px] transition-all duration-700"
        style={{
          background: anyIncidentActive
            ? 'radial-gradient(circle, rgba(196,96,90,0.4) 0%, rgba(201,164,92,0.12) 60%, transparent 100%)'
            : 'radial-gradient(circle, rgba(201,164,92,0.3) 0%, rgba(127,184,154,0.08) 60%, transparent 100%)'
        }}
        aria-hidden="true"
      />

      {/* In-App Phone-Style Notification Toast */}
      <PhoneToast
        toast={activeToast}
        onDismiss={() => setActiveToast(null)}
        showFocusButton={pipelineStatus === 'awaiting_approval'}
        onFocusApproval={() => {
          setActiveSection('pipeline');
          setTimeout(() => {
            approvalCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }}
      />

      {/* 21st.dev Page Chunks Navigation Drawer */}
      <NavigationDrawer
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        activeSection={activeSection}
        onSelectSection={(id) => setActiveSection(id)}
        anyIncidentActive={anyIncidentActive}
        onRunLiveDemo={handleRunLiveDemo}
        demoDisabled={pipelineStatus === 'running' || pipelineStatus === 'executing_fix'}
      />

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        telegramEnabled={telegramEnabled}
        onToggleTelegram={setTelegramEnabled}
        onSendTestAlert={handleSendTestAlert}
        isSendingTest={isSendingTestAlert}
        groqConnected={groqConnected}
        telegramConnected={telegramConnected}
      />

      {/* Sticky Editorial Control Room Header */}
      <header className="sticky top-0 z-30 bg-[#0b0f17]/90 backdrop-blur-md border-b border-[#c9a45c]/14 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Top Left: 21st.dev Aesthetic 3-Line Menu Icon + Brand Lockup */}
          <div className="flex items-center gap-3">
            <AnimatedMenuButton
              isOpen={isNavOpen}
              onClick={() => setIsNavOpen(!isNavOpen)}
              label="Open section chunks menu"
            />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111723] border border-[#c9a45c]/20 flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(201,164,92,0.08)]">
                <PulseIcon
                  className={`w-5 h-5 transition-colors ${
                    anyIncidentActive ? 'text-[#c4605a]' : 'text-[#c9a45c]'
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xl sm:text-2xl font-editorial font-semibold tracking-wider text-[#ece6d8]">
                    OpsPilot
                  </span>
                  <span className="text-[#c9a45c]/40 hidden sm:inline" aria-hidden="true">
                    ◆
                  </span>
                  <span className="text-xs text-[#8f8a7e] font-light hidden sm:inline tracking-wide">
                    Autonomous Incident Response
                  </span>
                </div>
                <p className="text-[11px] text-[#8f8a7e] font-light sm:hidden">
                  Autonomous Incident Response
                </p>
              </div>
            </div>
          </div>

          {/* Center / Right Controls: Status Dot with Glow Halo, Clock, Run Live Demo, Settings */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* System Status Indicator with Soft Glow Halo */}
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-colors ${
                anyIncidentActive
                  ? 'bg-[#1a141b] border-[#c4605a]/40 text-[#c4605a]'
                  : 'bg-[#111a19] border-[#7fb89a]/30 text-[#7fb89a]'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {anyIncidentActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c4605a] opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    anyIncidentActive
                      ? 'bg-[#c4605a] shadow-[0_0_8px_rgba(196,96,90,0.85)]'
                      : 'bg-[#7fb89a] shadow-[0_0_8px_rgba(127,184,154,0.7)]'
                  }`}
                />
              </span>
              <span className="whitespace-nowrap font-serif tracking-wide">
                {anyIncidentActive ? 'Incident Active' : 'All Systems Operational'}
              </span>
            </div>

            {/* Quick Restore All Button if any service is degraded */}
            {anyIncidentActive && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleRestoreAllServices}
                title="Immediately restore all services to healthy nominal state"
                className="px-3 py-1.5 rounded-xl text-xs font-mono text-[#7fb89a] bg-[#7fb89a]/15 hover:bg-[#7fb89a]/25 border border-[#7fb89a]/40 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <CheckCircleIcon className="w-3.5 h-3.5 text-[#7fb89a]" />
                <span className="hidden sm:inline">Restore All Nominal</span>
                <span className="sm:hidden">Restore</span>
              </motion.button>
            )}

            {/* Live Clock in JetBrains Mono */}
            <div
              className="hidden md:flex items-center gap-1.5 text-xs font-mono text-[#8f8a7e] bg-[#111723] px-3 py-2 rounded-xl border border-[#c9a45c]/14 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.05)]"
              aria-label="Control Room Live Clock"
            >
              <ClockIcon className="w-3.5 h-3.5 text-[#c9a45c]" />
              <span>{currentTime}</span>
            </div>

            {/* Run Live Demo Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleRunLiveDemo}
              disabled={pipelineStatus === 'running' || pipelineStatus === 'executing_fix'}
              className="min-h-[44px] px-4 sm:px-5 py-2 rounded-xl border border-[#c9a45c] bg-transparent hover:bg-[#c9a45c]/15 text-[#ece6d8] hover:text-[#e6c98a] font-editorial text-xs sm:text-sm tracking-wide flex items-center gap-2 transition-all duration-300 cursor-pointer disabled:opacity-40 shadow-[0_0_20px_-6px_rgba(201,164,92,0.2)] whitespace-nowrap shrink-0"
            >
              <PlayIcon className="w-3.5 h-3.5 fill-[#c9a45c]" />
              <span>Run Live Demo</span>
            </motion.button>

            {/* Settings Gear Button (min 44px tap target) */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open Control Room Settings"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-[#111723] hover:bg-[#c9a45c]/10 border border-[#c9a45c]/20 flex items-center justify-center text-[#8f8a7e] hover:text-[#ece6d8] transition-colors cursor-pointer shrink-0 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.05)]"
            >
              <SettingsIcon className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content Container with Generous Whitespace */}
      <main className="relative z-10 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 flex-1">
        {/* Section Chunks Quick Switcher & Breadcrumbs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-[12px] bg-[#111723] border border-[#c9a45c]/20 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.06)]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsNavOpen(true)}
              className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium flex items-center gap-1.5 hover:text-[#e6c98a] transition-colors cursor-pointer"
            >
              <DiamondOrnament className="w-2 h-2 text-[#c9a45c]" />
              <span>Page Chunk:</span>
            </button>
            <span className="font-editorial text-sm font-semibold text-[#ece6d8]">
              {currentChunkConfig?.roman !== 'Master' ? `${currentChunkConfig?.roman}. ` : ''}
              {currentChunkConfig?.name}
            </span>
          </div>

          {/* Quick Section Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {SECTION_CHUNKS.map((chunk) => {
              const isSelected = activeSection === chunk.id;
              return (
                <button
                  key={chunk.id}
                  type="button"
                  onClick={() => setActiveSection(chunk.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#c9a45c]/20 border border-[#c9a45c]/50 text-[#f7e8c3] shadow-sm'
                      : 'text-[#8f8a7e] hover:text-[#ece6d8] hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-[10px] text-[#c9a45c] font-serif">{chunk.roman}</span>
                  <span className="font-sans text-xs">{chunk.name.replace('Production ', '').replace('Live ', '').replace('Incident ', '')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Chunk Rendering with Framer Motion Animation */}
        <AnimatePresence mode="wait">
          {activeSection === 'all' && (
            <motion.div
              key="chunk-all"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-8"
            >
              {/* Dual Column Layout: Left (Services + Logs), Right (Pipeline + Approval) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-7 space-y-6">
                  {renderTopologyChunk()}
                  {renderTelemetryChunk(false)}
                </div>

                <div className="lg:col-span-5">
                  {renderPipelineChunk()}
                </div>
              </div>

              <GoldDivider label="Incident Audit" className="my-8" />
              {renderHistoryChunk()}
            </motion.div>
          )}

          {activeSection === 'topology' && (
            <motion.div
              key="chunk-topology"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-6 max-w-5xl mx-auto"
            >
              {renderTopologyChunk()}
              <div className="p-4 rounded-xl bg-[#0b0f17]/70 border border-[#c9a45c]/15 text-xs text-[#8f8a7e] flex items-center justify-between">
                <span>Click &ldquo;Simulate Failure&rdquo; on any service to dispatch autonomous diagnostics.</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('pipeline')}
                  className="text-[#c9a45c] hover:underline font-serif"
                >
                  Go to 4-Agent Pipeline →
                </button>
              </div>
            </motion.div>
          )}

          {activeSection === 'telemetry' && (
            <motion.div
              key="chunk-telemetry"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-6 max-w-5xl mx-auto"
            >
              {renderTelemetryChunk(true)}
            </motion.div>
          )}

          {activeSection === 'pipeline' && (
            <motion.div
              key="chunk-pipeline"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-6 max-w-4xl mx-auto"
            >
              {renderPipelineChunk()}
            </motion.div>
          )}

          {activeSection === 'history' && (
            <motion.div
              key="chunk-history"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-6 max-w-5xl mx-auto"
            >
              {renderHistoryChunk()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Classic Footer: tiny small-caps with ◆ on each side */}
      <footer className="relative z-10 border-t border-[#c9a45c]/14 py-6 mt-12 bg-[#0b0f17]/90">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8f8a7e]">
          <div className="flex items-center gap-2">
            <DiamondOrnament className="w-2.5 h-2.5 text-[#c9a45c]/70 fill-current" />
            <span className="text-[10px] uppercase tracking-[0.22em] font-sans font-medium text-[#c9a45c]">
              OpsPilot · Multi-Agent Incident Response
            </span>
            <DiamondOrnament className="w-2.5 h-2.5 text-[#c9a45c]/70 fill-current" />
          </div>
          <span className="font-mono text-[11px] text-[#8f8a7e]/80">
            I. Monitor · II. Triage · III. Diagnose · IV. Responder
          </span>
        </div>
      </footer>
    </div>
  );
}
