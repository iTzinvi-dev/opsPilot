import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PulseIcon,
  ShieldAlertIcon,
  CpuIcon,
  SendIcon,
  CheckCircleIcon,
  LoaderIcon,
  TerminalIcon,
  BookOpenIcon,
  PlayIcon,
  CopyIcon,
  CheckIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  CompassIcon,
  DiamondOrnament
} from './icons';
import {
  AgentRole,
  RUNBOOKS,
  ServiceConfig
} from '../data/scenarios';

export interface AgentStepData {
  role: AgentRole;
  index: string;
  name: string;
  subtitle: string;
  model: string;
  state: 'idle' | 'thinking' | 'typing' | 'done';
  displayedText: string;
  fullText: string;
  durationMs?: number;
}

interface AgentPipelineProps {
  steps: AgentStepData[];
  activeService: ServiceConfig | null;
  pipelineStatus: 'idle' | 'running' | 'awaiting_approval' | 'executing_fix' | 'resolved' | 'acknowledged';
  executionProgress: number;
  executionStageText: string;
  resolutionTimeSec: number | null;
  approvedBy?: 'telegram' | 'in-app';
  onApproveFix: () => void;
  onIgnoreIncident: () => void;
  onRunLiveDemo: () => void;
  approvalCardRef: React.RefObject<HTMLDivElement | null>;
}

const AGENT_ICONS: Record<AgentRole, React.ReactNode> = {
  monitor: <PulseIcon className="w-4 h-4" />,
  triage: <ShieldAlertIcon className="w-4 h-4" />,
  diagnose: <CpuIcon className="w-4 h-4" />,
  responder: <SendIcon className="w-4 h-4" />
};

export const AgentPipeline: React.FC<AgentPipelineProps> = ({
  steps,
  activeService,
  pipelineStatus,
  executionProgress,
  executionStageText,
  resolutionTimeSec,
  approvedBy,
  onApproveFix,
  onIgnoreIncident,
  onRunLiveDemo,
  approvalCardRef
}) => {
  const [showRunbooks, setShowRunbooks] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const matchedRunbookId =
    steps.find((s) => s.role === 'diagnose')?.state === 'done'
      ? activeService?.runbookId
      : undefined;

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard?.writeText(cmd);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Main Agent Pipeline Card with double hairline certificate border */}
      <section className="certificate-card p-5 sm:p-6">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#c9a45c]/14">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium flex items-center gap-1.5">
              <DiamondOrnament className="w-2 h-2 text-[#c9a45c]" />
              <span>Autonomous Response Pipeline</span>
            </p>
            <h2 className="text-xl font-editorial font-semibold text-[#ece6d8] mt-1">
              4-Agent Diagnostic Timeline
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRunbooks(!showRunbooks)}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#0b0f17] hover:bg-[#c9a45c]/10 border border-[#c9a45c]/20 text-xs font-medium text-[#ece6d8] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.05)]"
            >
              <BookOpenIcon className="w-3.5 h-3.5 text-[#c9a45c]" />
              <span className="font-serif">Runbooks (3)</span>
              {showRunbooks ? (
                <ChevronUpIcon className="w-3.5 h-3.5 text-[#8f8a7e]" />
              ) : (
                <ChevronDownIcon className="w-3.5 h-3.5 text-[#8f8a7e]" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Built-in Runbook Drawer */}
        <AnimatePresence>
          {showRunbooks && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mt-4 rounded-[12px] bg-[#0b0f17]/90 border border-[#c9a45c]/14 p-4 space-y-3 overflow-hidden shadow-[inset_0_0_0_1px_rgba(201,164,92,0.06)]"
            >
              <div className="flex items-center justify-between text-xs text-[#8f8a7e]">
                <span className="uppercase tracking-[0.18em] text-[10px] font-medium text-[#c9a45c]">
                  Built-in Remediation Runbooks
                </span>
                <span className="font-mono text-[11px] text-[#8f8a7e]">3 Verified Entries</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {RUNBOOKS.map((rb) => {
                  const isMatched = matchedRunbookId === rb.id;
                  return (
                    <div
                      key={rb.id}
                      className={`rounded-xl p-3 border transition-colors ${
                        isMatched
                          ? 'bg-[#c9a45c]/10 border-[#c9a45c]/45'
                          : 'bg-[#111723]/70 border-[#c9a45c]/10'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-medium text-[#c9a45c]">
                            {rb.id}
                          </span>
                          <span className="text-[#c9a45c]/40" aria-hidden="true">·</span>
                          <span className="font-medium text-[#ece6d8] font-editorial text-sm">
                            {rb.title}
                          </span>
                        </div>
                        {isMatched && (
                          <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-[#7fb89a] border border-[#7fb89a]/30 px-2 py-0.5 rounded">
                            Matched by Diagnose Agent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8f8a7e] mt-1 font-light">
                        Symptom: {rb.symptomSignature}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-mono text-[#7fb89a] bg-[#0b0f17] px-2.5 py-1.5 rounded-lg border border-[#c9a45c]/10">
                        <code className="truncate">$ {rb.fixCommand}</code>
                        <span className="text-[#8f8a7e] shrink-0 font-light">target: {rb.serviceName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Refined Luxury Editorial Empty State when Idle */}
        {pipelineStatus === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mt-6 rounded-[12px] bg-[#0b0f17]/60 border border-[#c9a45c]/14 p-6 sm:p-7 text-center space-y-3.5 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.06)]"
          >
            <div className="mx-auto w-10 h-10 rounded-full bg-[#c9a45c]/10 border border-[#c9a45c]/25 flex items-center justify-center text-[#c9a45c] shadow-[0_0_16px_rgba(201,164,92,0.2)]">
              <CompassIcon className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <h3 className="font-editorial italic text-xl sm:text-2xl text-[#ece6d8]">
                All systems are calm.
              </h3>
              <p className="text-xs text-[#8f8a7e] font-light max-w-sm mx-auto leading-relaxed">
                Autonomous agents stand watch over primary telemetry feeds and node integrity.
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onRunLiveDemo}
                className="min-h-[44px] px-5 py-2 rounded-xl border border-[#c9a45c] bg-transparent hover:bg-[#c9a45c]/15 text-[#ece6d8] hover:text-[#e6c98a] font-editorial text-sm tracking-wide flex items-center gap-2 transition-all duration-300 cursor-pointer shadow-[0_0_20px_-6px_rgba(201,164,92,0.25)]"
              >
                <PlayIcon className="w-3.5 h-3.5 fill-[#c9a45c]" />
                <span>Run Live Demo</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Vertical Timeline of 4 Agents */}
        <div className="mt-6 space-y-0">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isIdle = step.state === 'idle';
            const isThinking = step.state === 'thinking';
            const isTyping = step.state === 'typing';
            const isDone = step.state === 'done';
            const isActive = isThinking || isTyping;

            // Roman numerals formatting
            const romanLabel =
              step.role === 'monitor'
                ? 'I'
                : step.role === 'triage'
                ? 'II'
                : step.role === 'diagnose'
                ? 'III'
                : 'IV';

            const connectorProgress = isDone ? '100%' : isActive ? '50%' : '0%';

            return (
              <div key={step.role} className="relative flex gap-4">
                {/* Left Vertical Node & Animated Connecting Line */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                      isDone
                        ? 'bg-[#7fb89a]/15 border-[#7fb89a]/50 text-[#7fb89a]'
                        : isActive
                        ? 'bg-[#c9a45c]/20 border-[#c9a45c] text-[#c9a45c] shadow-[0_0_18px_rgba(201,164,92,0.35)]'
                        : 'bg-[#0b0f17] border-[#c9a45c]/15 text-[#8f8a7e]'
                    }`}
                  >
                    {isThinking ? (
                      <LoaderIcon className="w-4 h-4 animate-spin text-[#d9a441]" />
                    ) : isDone ? (
                      <CheckCircleIcon className="w-4 h-4 text-[#7fb89a]" />
                    ) : (
                      AGENT_ICONS[step.role]
                    )}
                  </div>

                  {!isLast && (
                    <div className="w-[1.5px] flex-1 min-h-[38px] bg-[#c9a45c]/12 my-1.5 relative overflow-hidden rounded-full">
                      <motion.div
                        className="w-full bg-gradient-to-b from-[#c9a45c] to-[#7fb89a]"
                        initial={{ height: 0 }}
                        animate={{ height: connectorProgress }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      />
                    </div>
                  )}
                </div>

                {/* Right Agent Content Box with Certificate Double-Line Border */}
                <div className={`flex-1 ${!isLast ? 'pb-6' : 'pb-1'} min-w-0`}>
                  <div
                    className={`rounded-[12px] border p-4 transition-all duration-300 ${
                      isActive
                        ? 'bg-[#151c29] border-[#c9a45c]/45 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.1),0_8px_24px_-8px_rgba(201,164,92,0.2)]'
                        : isDone
                        ? 'bg-[#0e1420] border-[#c9a45c]/18 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.05)]'
                        : 'bg-[#0b0f17]/50 border-[#c9a45c]/10'
                    }`}
                  >
                    {/* Agent Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Roman numeral in gold serif */}
                        <span className="font-editorial text-sm font-semibold tracking-wider text-[#c9a45c]">
                          {romanLabel}.
                        </span>
                        <h3 className="text-sm font-serif font-semibold text-[#ece6d8] tracking-wide">
                          {step.name}
                        </h3>
                        <span className="text-[#c9a45c]/30 hidden sm:inline" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs text-[#8f8a7e] font-light hidden sm:inline">
                          {step.subtitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="px-2 py-0.5 rounded bg-[#0b0f17] border border-[#c9a45c]/14 text-[11px] font-mono text-[#8f8a7e]">
                          {step.model.replace('-instant', '').replace('-versatile', '')}
                          {step.durationMs ? ` · ${(step.durationMs / 1000).toFixed(1)}s` : ''}
                        </span>
                        {isIdle && (
                          <span className="text-[10px] uppercase tracking-[0.14em] text-[#8f8a7e] border border-[#c9a45c]/10 px-2 py-0.5 rounded">
                            Standby
                          </span>
                        )}
                        {isThinking && (
                          <span className="text-[10px] uppercase tracking-[0.14em] text-[#d9a441] border border-[#d9a441]/30 px-2 py-0.5 rounded flex items-center gap-1.5">
                            <SparklesIcon className="w-2.5 h-2.5 text-[#d9a441]" />
                            <span>Analyzing</span>
                          </span>
                        )}
                        {isTyping && (
                          <span className="text-[10px] uppercase tracking-[0.14em] text-[#c9a45c] border border-[#c9a45c]/40 px-2 py-0.5 rounded">
                            Streaming
                          </span>
                        )}
                        {isDone && (
                          <span className="text-[10px] uppercase tracking-[0.14em] text-[#7fb89a] border border-[#7fb89a]/30 px-2 py-0.5 rounded">
                            Done
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[#8f8a7e] font-light sm:hidden mt-0.5">
                      {step.subtitle}
                    </p>

                    {/* Agent Body State */}
                    <div className="mt-3">
                      {isIdle && (
                        <p className="text-xs text-[#8f8a7e] font-serif italic">
                          Awaiting upstream telemetry trigger...
                        </p>
                      )}

                      {isThinking && (
                        <div className="space-y-2 py-1" aria-label="Agent analyzing telemetry">
                          <div className="h-3 w-11/12 rounded bg-[#c9a45c]/10 animate-pulse" />
                          <div className="h-3 w-4/5 rounded bg-[#c9a45c]/08 animate-pulse" />
                          <div className="h-3 w-3/5 rounded bg-[#c9a45c]/05 animate-pulse" />
                        </div>
                      )}

                      {(isTyping || isDone) && (
                        <div className="space-y-3">
                          <p className="text-sm text-[#ece6d8] leading-relaxed font-light">
                            {step.displayedText}
                            {isTyping && (
                              <span
                                className="inline-block w-1.5 h-4 ml-1 align-middle bg-[#c9a45c] animate-pulse"
                                aria-hidden="true"
                              />
                            )}
                          </p>

                          {/* Contextual Structured Metadata Footers per Agent Role */}
                          {isDone && activeService && step.role === 'triage' && (
                            <div className="pt-2 border-t border-[#c9a45c]/12 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <span className="text-[#8f8a7e] text-[11px] uppercase tracking-[0.14em]">
                                Assigned Severity:
                              </span>
                              {/* Incident severity as an elegant small-caps tag with thin border */}
                              <span
                                className={`font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded border ${
                                  activeService.severity === 'Critical'
                                    ? 'border-[#c4605a]/45 text-[#c4605a]'
                                    : activeService.severity === 'High'
                                    ? 'border-[#d9a441]/45 text-[#d9a441]'
                                    : 'border-[#7fb89a]/45 text-[#7fb89a]'
                                }`}
                              >
                                {activeService.severity}
                              </span>
                              <span className="text-[#c9a45c]/30" aria-hidden="true">·</span>
                              <span className="text-[#ece6d8] font-light">{activeService.userImpact}</span>
                            </div>
                          )}

                          {isDone && activeService && step.role === 'diagnose' && (
                            <div className="pt-2 border-t border-[#c9a45c]/12 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 text-[#ece6d8]">
                                <BookOpenIcon className="w-3.5 h-3.5 text-[#c9a45c] shrink-0" />
                                <span>
                                  Matched Runbook{' '}
                                  <strong className="font-mono text-[#c9a45c]">
                                    {activeService.runbookId}
                                  </strong>
                                </span>
                              </div>
                              <code className="font-mono text-[11px] text-[#7fb89a] bg-[#0b0f17] px-2.5 py-1 rounded-md border border-[#c9a45c]/12">
                                $ {activeService.fixCommand}
                              </code>
                            </div>
                          )}

                          {isDone && activeService && step.role === 'responder' && (
                            <div className="pt-2 border-t border-[#c9a45c]/12 flex items-center gap-2 text-xs">
                              {approvedBy === 'telegram' ? (
                                <>
                                  <CheckCircleIcon className="w-3.5 h-3.5 text-[#7fb89a] shrink-0" />
                                  <span className="font-serif italic text-[#7fb89a] font-medium">
                                    Remediation approved via Telegram inline buttons · Executed
                                  </span>
                                </>
                              ) : (
                                <>
                                  <SendIcon className="w-3.5 h-3.5 text-[#c9a45c] shrink-0" />
                                  <span className="font-serif italic text-[#c9a45c]">
                                    On-call Telegram alert dispatched · Remediation staged for engineer sign-off
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Approval Card: Prominent Action Panel with fine double-line border */}
      {activeService &&
        (pipelineStatus === 'awaiting_approval' ||
          pipelineStatus === 'executing_fix' ||
          pipelineStatus === 'resolved' ||
          pipelineStatus === 'acknowledged') && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            ref={approvalCardRef}
            className={`rounded-[12px] p-5 sm:p-6 border transition-all duration-300 ${
              pipelineStatus === 'awaiting_approval'
                ? 'bg-[#151b29] border-[#c9a45c]/45 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.1),0_20px_48px_-12px_rgba(201,164,92,0.22)]'
                : pipelineStatus === 'executing_fix'
                ? 'bg-[#131b28] border-[#d9a441]/40 shadow-[inset_0_0_0_1px_rgba(217,164,65,0.08)]'
                : pipelineStatus === 'resolved'
                ? 'bg-[#101c1d] border-[#7fb89a]/40 shadow-[inset_0_0_0_1px_rgba(127,184,154,0.08)]'
                : 'bg-[#171520] border-[#c4605a]/35 shadow-[inset_0_0_0_1px_rgba(196,96,90,0.08)]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium flex items-center gap-1.5">
                  <DiamondOrnament className="w-2 h-2 text-[#c9a45c]" />
                  <span>
                    {pipelineStatus === 'awaiting_approval'
                      ? 'Human-in-the-Loop Sign-off Required'
                      : pipelineStatus === 'executing_fix'
                      ? (approvedBy === 'telegram' ? 'Remediation in Progress (Approved via Telegram)' : 'Autonomous Remediation in Progress')
                      : pipelineStatus === 'resolved'
                      ? (approvedBy === 'telegram' ? 'Incident Remediated · Approved via Telegram' : 'Incident Remediated & Verified')
                      : 'Incident Acknowledged · Fix Deferred'}
                  </span>
                </p>
                <h3 className="text-xl font-editorial font-semibold text-[#ece6d8] mt-1">
                  {pipelineStatus === 'resolved'
                    ? `${activeService.name} Restored to Nominal Operation${approvedBy === 'telegram' ? ' (via Telegram)' : ''}`
                    : pipelineStatus === 'acknowledged'
                    ? `${activeService.name} Alert Acknowledged`
                    : `Proposed Fix for ${activeService.name}`}
                </h3>
              </div>

              {pipelineStatus === 'resolved' && resolutionTimeSec !== null && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#7fb89a] bg-[#7fb89a]/10 px-3 py-1.5 rounded-lg border border-[#7fb89a]/30">
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>Resolved in {resolutionTimeSec}s</span>
                </div>
              )}
            </div>

            <p className="text-xs text-[#8f8a7e] mt-2 leading-relaxed font-light">
              {activeService.rootCauseShort} Matched to{' '}
              <span className="font-mono text-[#c9a45c]">{activeService.runbookId}</span>.
            </p>

            {/* Code Block with Proposed Fix Command */}
            <div className="mt-4 rounded-[12px] bg-[#090d14] border border-[#c9a45c]/15 p-3.5 flex items-center justify-between gap-3 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.05)]">
              <div className="flex items-center gap-2.5 min-w-0 font-mono text-xs sm:text-sm text-[#7fb89a]">
                <TerminalIcon className="w-4 h-4 text-[#c9a45c] shrink-0" />
                <code className="truncate select-all">{activeService.fixCommand}</code>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCommand(activeService.fixCommand)}
                aria-label="Copy remediation command"
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-[#8f8a7e] hover:text-[#ece6d8] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-[#c9a45c]/10"
              >
                {copiedCommand ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5 text-[#7fb89a]" />
                    <span className="text-[#7fb89a]">Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Executing Progress Bar */}
            {pipelineStatus === 'executing_fix' && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#d9a441] flex items-center gap-2">
                    <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                    <span>{executionStageText}</span>
                  </span>
                  <span className="text-[#8f8a7e]">{executionProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#0b0f17] overflow-hidden border border-[#c9a45c]/15">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#c9a45c] to-[#7fb89a]"
                    animate={{ width: `${executionProgress}%` }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons: Solid Antique Gold for Approve, Ghost Outline for Decline */}
            {pipelineStatus === 'awaiting_approval' && (
              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onApproveFix}
                  className="flex-1 min-h-[46px] px-6 py-2.5 rounded-xl bg-[#c9a45c] hover:bg-[#e6c98a] text-[#0b0f17] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[0_4px_20px_-4px_rgba(201,164,92,0.35)] whitespace-nowrap"
                >
                  <CheckCircleIcon className="w-4 h-4 text-[#0b0f17]" />
                  <span>Approve Fix</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onIgnoreIncident}
                  className="sm:w-36 min-h-[46px] px-5 py-2.5 rounded-xl bg-transparent hover:bg-white/[0.04] border border-[#c9a45c]/25 hover:border-[#c9a45c]/50 text-[#8f8a7e] hover:text-[#ece6d8] font-medium text-sm flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap"
                >
                  Decline
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
    </div>
  );
};
