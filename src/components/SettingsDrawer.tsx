import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  XIcon,
  SendIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  BookOpenIcon,
  TerminalIcon,
  ShieldCheckIcon,
  DiamondOrnament,
  PulseIcon,
  LoaderIcon
} from './icons';
import { RUNBOOKS } from '../data/scenarios';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  telegramEnabled: boolean;
  onToggleTelegram: (enabled: boolean) => void;
  onSendTestAlert?: () => void;
  isSendingTest?: boolean;
  groqConnected: boolean;
  telegramConnected: boolean;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  telegramEnabled,
  onToggleTelegram,
  groqConnected,
  telegramConnected
}) => {
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    messageId?: number;
  } | null>(null);

  const [isConnectingWebhook, setIsConnectingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{
    success: boolean;
    message: string;
    webhookUrl?: string;
  } | null>(null);

  const [telegramConfig, setTelegramConfig] = useState<{
    hasToken: boolean;
    botId: string | null;
    botUsername: string | null;
    botName: string | null;
    configuredChatId: string | null;
    activeChatId: string | null;
    isBotSelfChat: boolean;
    hasOverride: boolean;
    latestDetectedUser?: { id: number | string; username?: string; firstName?: string } | null;
  } | null>(null);

  const [chatIdInput, setChatIdInput] = useState<string>(() => {
    return localStorage.getItem('opspilot_custom_chat_id') || '';
  });
  const [isSavingChatId, setIsSavingChatId] = useState(false);
  const [isDetectingChat, setIsDetectingChat] = useState(false);
  const [chatIdNotice, setChatIdNotice] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchTelegramConfig = async () => {
    try {
      const res = await fetch('/api/telegram/config');
      const data = await res.json();
      if (data.ok) {
        setTelegramConfig(data);
        if (!chatIdInput) {
          const stored = localStorage.getItem('opspilot_custom_chat_id');
          if (stored) {
            setChatIdInput(stored);
          } else if (data.activeChatId && !data.isBotSelfChat) {
            setChatIdInput(data.activeChatId);
          }
        }
      }
    } catch {
      // Ignore transient failures
    }
  };

  const [healthStatus, setHealthStatus] = useState<{ groq: boolean; telegram: boolean }>({
    groq: groqConnected,
    telegram: telegramConnected
  });

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data && data.ok) {
        setHealthStatus({
          groq: Boolean(data.groq),
          telegram: Boolean(data.telegram)
        });
      }
    } catch {
      // Ignore transient failures
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
      fetchTelegramConfig();
    }
  }, [isOpen]);

  const handleSaveChatId = async () => {
    const trimmed = chatIdInput.trim();
    if (!trimmed) {
      setChatIdNotice({
        success: false,
        message: 'Please enter a valid personal Telegram Chat ID (numeric).'
      });
      return;
    }

    setIsSavingChatId(true);
    setChatIdNotice(null);

    try {
      const res = await fetch('/api/telegram/chat-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: trimmed })
      });
      const data = await res.json();

      if (data.ok) {
        localStorage.setItem('opspilot_custom_chat_id', trimmed);
        setChatIdNotice({
          success: true,
          message: `Personal Chat ID successfully linked: ${trimmed}`
        });
        await fetchTelegramConfig();
      } else {
        setChatIdNotice({
          success: false,
          message: data.error || 'Failed to update Chat ID.'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setChatIdNotice({
        success: false,
        message: `Network error saving Chat ID: ${msg}`
      });
    } finally {
      setIsSavingChatId(false);
    }
  };

  const handleAutoDetectChat = async () => {
    setIsDetectingChat(true);
    setChatIdNotice(null);

    try {
      const res = await fetch('/api/telegram/auto-detect-chat', { method: 'POST' });
      const data = await res.json();

      if (data.ok && data.activeChatId) {
        setChatIdInput(data.activeChatId);
        localStorage.setItem('opspilot_custom_chat_id', data.activeChatId);
        setChatIdNotice({
          success: true,
          message: data.message || `Detected active user chat ID: ${data.activeChatId}`
        });
        await fetchTelegramConfig();
      } else {
        setChatIdNotice({
          success: false,
          message:
            data.error ||
            'Could not auto-detect. Send /start or any message to your bot in Telegram, then click Auto-Detect.'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setChatIdNotice({
        success: false,
        message: `Detection error: ${msg}`
      });
    } finally {
      setIsDetectingChat(false);
    }
  };

  const handleSendTestAlertInternal = async () => {
    setIsSendingTest(true);
    setTestResult(null);

    const testMessage = [
      '🚨 OpsPilot Alert (Synthetic Verification)',
      'Service: API Gateway',
      'Severity: High',
      'Root cause: Webhook and interactive button test triggered from OpsPilot Settings.',
      'Proposed fix: docker restart api-gateway',
      'Select an action below to test callback handling.'
    ].join('\n');

    try {
      const effectiveChatId = chatIdInput.trim() || localStorage.getItem('opspilot_custom_chat_id') || undefined;

      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: 'API Gateway (Test)',
          serviceId: 'api',
          severity: 'High',
          rootCause: 'Manual webhook verification triggered from Control Room Settings.',
          proposedFix: 'docker restart api-gateway',
          customMessage: testMessage,
          isTest: true,
          chatId: effectiveChatId
        })
      });

      const data = await res.json();

      if (data.ok && data.deliveredVia === 'telegram') {
        setTestResult({
          success: true,
          message: `Alert delivered successfully to Telegram chat ${data.chatId || effectiveChatId || ''}! (Message ID: ${data.messageId || 'verified'})`,
          messageId: data.messageId
        });
      } else if (data.ok && data.deliveredVia === 'fallback-toast') {
        setTestResult({
          success: false,
          message: data.error || 'Server environment variables TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID are not set.'
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Telegram API returned an error dispatching the message.'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: `Network error connecting to /api/telegram: ${msg}`
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleConnectWebhook = async () => {
    setIsConnectingWebhook(true);
    setWebhookResult(null);

    try {
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appUrl: window.location.origin
        })
      });

      const data = await res.json();

      if (data.ok) {
        setWebhookResult({
          success: true,
          message: data.description || 'Webhook registered with Telegram. Interactive inline buttons [Approve] and [Decline] are active!',
          webhookUrl: data.webhookUrl
        });
      } else {
        setWebhookResult({
          success: false,
          message: data.error || 'Telegram returned an error registering the webhook.'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setWebhookResult({
        success: false,
        message: `Network error calling /api/telegram/set-webhook: ${msg}`
      });
    } finally {
      setIsConnectingWebhook(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop with soft fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-[#0b0f17]/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel with graceful 300-400ms slide-in */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Control Room Settings"
            className="relative z-10 w-full max-w-md bg-[#111723] border-l border-[#c9a45c]/20 h-full flex flex-col justify-between overflow-y-auto shadow-2xl"
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#c9a45c]/15 bg-[#0b0f17]/50">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium flex items-center gap-1.5">
                    <DiamondOrnament className="w-2 h-2 text-[#c9a45c]" />
                    <span>Control Room Configuration</span>
                  </p>
                  <h2 className="text-xl font-editorial font-semibold text-[#ece6d8] mt-1">
                    Settings &amp; Integrations
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close settings drawer"
                  className="w-11 h-11 rounded-xl border border-[#c9a45c]/20 flex items-center justify-center text-[#8f8a7e] hover:text-[#ece6d8] hover:bg-[#c9a45c]/10 transition-colors cursor-pointer"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Telegram Dispatch & Interactive Buttons Controls */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-editorial text-lg font-semibold text-[#ece6d8]">
                        Telegram Alerts &amp; Buttons
                      </h3>
                      <p className="text-xs text-[#8f8a7e] mt-0.5 leading-relaxed font-light">
                        Dispatch on-call incident alerts with interactive [✅ Approve] and [❌ Decline] inline buttons.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={telegramEnabled}
                      onClick={() => onToggleTelegram(!telegramEnabled)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-[#c9a45c]/30 transition-colors duration-200 ease-in-out focus:outline-none min-w-[48px] min-h-[28px] items-center ${
                        telegramEnabled ? 'bg-[#c9a45c]' : 'bg-[#0b0f17]'
                      }`}
                    >
                      <span className="sr-only">Toggle Telegram alerts</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full border border-[#c9a45c]/40 shadow-sm transition duration-200 ease-in-out ${
                          telegramEnabled ? 'translate-x-5 bg-[#0b0f17]' : 'translate-x-0.5 bg-[#8f8a7e]/40'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Telegram Bot Identity & Active Chat ID Status */}
                  <div className="rounded-[12px] bg-[#0b0f17]/90 border border-[#c9a45c]/16 p-3.5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#8f8a7e] font-mono uppercase tracking-[0.12em] text-[10px]">
                        Target Recipient
                      </span>
                      <span className="text-[11px] font-mono text-[#c9a45c] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7fb89a]" />
                        Bot: @{telegramConfig?.botUsername || 'neowmoonbot'} (ID: {telegramConfig?.botId || '9207836149'})
                      </span>
                    </div>

                    {/* Bot Self-Chat Warning Notice if configured ID is the bot itself */}
                    {(telegramConfig?.isBotSelfChat ||
                      (telegramConfig?.botId && chatIdInput === telegramConfig.botId) ||
                      testResult?.message?.includes("Forbidden: the bot can't send messages to the bot")) && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg border border-[#d9a441]/40 bg-[#d9a441]/10 text-xs text-[#fde047] space-y-1.5"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangleIcon className="w-4 h-4 text-[#d9a441] shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-[#ece6d8]">
                              Destination Chat ID is set to Bot ID ({telegramConfig?.botId || '9207836149'})
                            </p>
                            <p className="text-[11px] text-[#fef08a] leading-relaxed mt-0.5">
                              Telegram bots cannot message themselves. Please paste your personal user ID below or click Auto-Detect after messaging the bot.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Personal Chat ID Input & Actions */}
                    <div className="space-y-2">
                      <label htmlFor="telegram-chat-id-input" className="block text-[11px] text-[#8f8a7e] font-sans">
                        Personal Telegram Chat ID:
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="telegram-chat-id-input"
                          type="text"
                          value={chatIdInput}
                          onChange={(e) => setChatIdInput(e.target.value)}
                          placeholder="e.g. 81928374 (numeric user ID)"
                          className="flex-1 px-3 py-2 rounded-lg bg-[#111723] border border-[#c9a45c]/25 text-xs text-[#ece6d8] placeholder-[#8f8a7e]/60 font-mono focus:outline-none focus:border-[#c9a45c]"
                        />
                        <button
                          type="button"
                          onClick={handleSaveChatId}
                          disabled={isSavingChatId}
                          className="px-3 py-2 rounded-lg bg-[#c9a45c] hover:bg-[#e6c98a] text-[#0b0f17] text-xs font-semibold font-mono tracking-wide transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isSavingChatId ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoDetectChat}
                          disabled={isDetectingChat}
                          title="Auto-detect from recent messages to @neowmoonbot"
                          className="px-3 py-2 rounded-lg border border-[#7fb89a]/40 bg-[#7fb89a]/10 hover:bg-[#7fb89a]/20 text-[#7fb89a] text-xs font-mono transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {isDetectingChat ? 'Detecting...' : 'Auto-Detect'}
                        </button>
                      </div>

                      <p className="text-[10px] text-[#8f8a7e] leading-relaxed font-light">
                        Tip: Open Telegram → message <span className="text-[#c9a45c] font-mono">@userinfobot</span> to get your personal ID, or message <span className="text-[#c9a45c] font-mono">@{telegramConfig?.botUsername || 'neowmoonbot'}</span> directly and click Auto-Detect.
                      </p>

                      {/* Chat ID feedback message */}
                      {chatIdNotice && (
                        <p
                          className={`text-[11px] font-mono ${
                            chatIdNotice.success ? 'text-[#7fb89a]' : 'text-[#fca5a5]'
                          }`}
                        >
                          {chatIdNotice.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Send Test Alert Button */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleSendTestAlertInternal}
                      disabled={isSendingTest}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#c9a45c]/30 bg-[#c9a45c]/10 hover:bg-[#c9a45c]/20 text-xs font-medium text-[#ece6d8] flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSendingTest ? (
                        <LoaderIcon className="w-3.5 h-3.5 animate-spin text-[#c9a45c]" />
                      ) : (
                        <SendIcon className="w-3.5 h-3.5 text-[#c9a45c]" />
                      )}
                      <span>{isSendingTest ? 'Sending...' : 'Send Test Alert'}</span>
                    </motion.button>

                    {/* Connect Telegram Buttons Button */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleConnectWebhook}
                      disabled={isConnectingWebhook}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#7fb89a]/35 bg-[#7fb89a]/10 hover:bg-[#7fb89a]/20 text-xs font-medium text-[#ece6d8] flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isConnectingWebhook ? (
                        <LoaderIcon className="w-3.5 h-3.5 animate-spin text-[#7fb89a]" />
                      ) : (
                        <PulseIcon className="w-3.5 h-3.5 text-[#7fb89a]" />
                      )}
                      <span>{isConnectingWebhook ? 'Connecting...' : 'Connect Buttons'}</span>
                    </motion.button>
                  </div>

                  {/* Real Test Alert Result Feedback */}
                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl border text-xs leading-relaxed font-mono ${
                        testResult.success
                          ? 'bg-[#7fb89a]/10 border-[#7fb89a]/40 text-[#7fb89a]'
                          : 'bg-[#c4605a]/10 border-[#c4605a]/40 text-[#fca5a5]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {testResult.success ? (
                          <CheckCircleIcon className="w-4 h-4 text-[#7fb89a] shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangleIcon className="w-4 h-4 text-[#c4605a] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-sans font-medium">
                            {testResult.success ? 'Telegram API Dispatch Success' : 'Telegram API Response Notice'}
                          </p>
                          <p className="mt-1 text-[11px] break-words font-light">
                            {testResult.message}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Real Webhook Connection Result Feedback */}
                  {webhookResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl border text-xs leading-relaxed font-mono ${
                        webhookResult.success
                          ? 'bg-[#7fb89a]/10 border-[#7fb89a]/40 text-[#7fb89a]'
                          : 'bg-[#c4605a]/10 border-[#c4605a]/40 text-[#fca5a5]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {webhookResult.success ? (
                          <CheckCircleIcon className="w-4 h-4 text-[#7fb89a] shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangleIcon className="w-4 h-4 text-[#c4605a] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-sans font-medium">
                            {webhookResult.success ? 'Telegram Webhook Connected' : 'Telegram Webhook Response Notice'}
                          </p>
                          <p className="mt-1 text-[11px] break-words font-light">
                            {webhookResult.message}
                          </p>
                          {webhookResult.webhookUrl && (
                            <p className="mt-1 text-[10px] text-[#8f8a7e] truncate font-mono">
                              Endpoint: {webhookResult.webhookUrl}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </section>

                {/* Subtle Divider */}
                <div className="flex items-center gap-3 w-full select-none" aria-hidden="true">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9a45c]/20 to-[#c9a45c]/30" />
                  <span className="text-[#c9a45c]/60 text-[8px]">◆</span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-[#c9a45c]/30 via-[#c9a45c]/20 to-transparent" />
                </div>

                {/* Server Integration Telemetry */}
                <section className="space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium">
                    Server-Side Connection Status
                  </p>

                  <div className="rounded-[12px] bg-[#0b0f17]/80 border border-[#c9a45c]/14 p-4 space-y-3 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.06)]">
                    {/* Ai Engine Section */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-1 transition-colors ${
                            healthStatus.groq
                              ? 'bg-[#7fb89a] shadow-[0_0_8px_rgba(127,184,154,0.9)]'
                              : 'bg-[#c4605a] shadow-[0_0_8px_rgba(196,96,90,0.9)]'
                          }`}
                        />
                        <div>
                          <p className="text-xs font-medium text-[#ece6d8] flex items-center gap-1.5">
                            <span>Ai Engine</span>
                          </p>
                          <p className="text-[11px] text-[#8f8a7e] mt-0.5 font-light">
                            Connection status{healthStatus.groq ? ' · Online' : ' · Standby Fallback'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-[0.14em] font-mono shrink-0 px-2 py-0.5 rounded border ${
                          healthStatus.groq
                            ? 'border-[#7fb89a]/30 text-[#7fb89a]'
                            : 'border-[#c4605a]/30 text-[#fca5a5]'
                        }`}
                      >
                        {healthStatus.groq ? 'Connected' : 'Fallback Ready'}
                      </span>
                    </div>

                    {/* Telegram Bot API Section */}
                    <div className="border-t border-[#c9a45c]/10 pt-3 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-1 transition-colors ${
                            healthStatus.telegram
                              ? 'bg-[#7fb89a] shadow-[0_0_8px_rgba(127,184,154,0.9)]'
                              : 'bg-[#c4605a] shadow-[0_0_8px_rgba(196,96,90,0.9)]'
                          }`}
                        />
                        <div>
                          <p className="text-xs font-medium text-[#ece6d8]">
                            Telegram Bot API (sendMessage &amp; Webhook)
                          </p>
                          <p className="text-[11px] text-[#8f8a7e] mt-0.5 font-light">
                            {healthStatus.telegram
                              ? 'Connected via server bot token & chat ID'
                              : 'Requires TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID in server environment'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-[0.14em] font-mono shrink-0 px-2 py-0.5 rounded border ${
                          healthStatus.telegram
                            ? 'border-[#7fb89a]/30 text-[#7fb89a]'
                            : 'border-[#c4605a]/30 text-[#fca5a5]'
                        }`}
                      >
                        {healthStatus.telegram ? 'Connected' : 'Configure Env'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#8f8a7e] pt-1">
                    <ShieldCheckIcon className="w-3.5 h-3.5 text-[#7fb89a] shrink-0" />
                    <span className="font-light">
                      Tokens are read exclusively on the server and are never exposed to the client.
                    </span>
                  </div>
                </section>

                {/* Subtle Divider */}
                <div className="flex items-center gap-3 w-full select-none" aria-hidden="true">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9a45c]/20 to-[#c9a45c]/30" />
                  <span className="text-[#c9a45c]/60 text-[8px]">◆</span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-[#c9a45c]/30 via-[#c9a45c]/20 to-transparent" />
                </div>

                {/* Built-in Runbook Library Reference */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium flex items-center gap-1.5">
                      <BookOpenIcon className="w-3.5 h-3.5 text-[#c9a45c]" />
                      <span>Built-in Runbook Registry (3 Entries)</span>
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {RUNBOOKS.map((rb) => (
                      <div
                        key={rb.id}
                        className="rounded-[12px] bg-[#0b0f17]/70 border border-[#c9a45c]/14 p-3.5 space-y-1.5 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.05)]"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-medium text-[#c9a45c]">
                            {rb.id} · {rb.serviceName}
                          </span>
                          <span className="font-mono text-[11px] text-[#8f8a7e]">
                            ~{rb.estimatedRecoverySec}s recovery
                          </span>
                        </div>
                        <p className="text-xs font-editorial text-sm font-medium text-[#ece6d8]">{rb.title}</p>
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] font-mono text-[#7fb89a]">
                          <TerminalIcon className="w-3 h-3 shrink-0" />
                          <code className="truncate">$ {rb.fixCommand}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="p-6 border-t border-[#c9a45c]/15 bg-[#0b0f17]/50 text-xs text-[#8f8a7e] flex items-center justify-between">
              <span className="font-serif tracking-wide text-[#ece6d8]">OpsPilot Control Room</span>
              <span className="font-mono text-[11px] text-[#c9a45c]">4-Agent Autonomous Pipeline</span>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
