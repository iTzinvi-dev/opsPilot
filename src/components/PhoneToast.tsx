import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SendIcon,
  CheckCircleIcon,
  ShieldAlertIcon,
  XIcon,
  ArrowDownRightIcon,
  DiamondOrnament
} from './icons';

export interface TelegramToastData {
  id: string;
  type: 'telegram' | 'resolved' | 'acknowledged';
  title: string;
  subtitle: string;
  body: string;
  deliveredVia?: 'telegram' | 'fallback-toast' | 'disabled';
  timestamp: string;
}

interface PhoneToastProps {
  toast: TelegramToastData | null;
  onDismiss: () => void;
  onFocusApproval?: () => void;
  showFocusButton?: boolean;
}

export const PhoneToast: React.FC<PhoneToastProps> = ({
  toast,
  onDismiss,
  onFocusApproval,
  showFocusButton
}) => {
  const isTelegram = toast?.type === 'telegram';
  const isResolved = toast?.type === 'resolved';

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          aria-live="polite"
          className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[410px] z-50 pointer-events-auto"
        >
          <div className="rounded-[12px] bg-[#111723]/95 backdrop-blur-xl border border-[#c9a45c]/25 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.08),0_24px_54px_-12px_rgba(0,0,0,0.85)] overflow-hidden">
            {/* Top header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0b0f17]/70 border-b border-[#c9a45c]/15">
              <div className="flex items-center gap-2">
                {isTelegram ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#c9a45c]/15 text-[#c9a45c]">
                    <SendIcon className="w-3 h-3 text-[#c9a45c]" />
                  </span>
                ) : isResolved ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#7fb89a]/15 text-[#7fb89a]">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-[#7fb89a]" />
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#d9a441]/15 text-[#d9a441]">
                    <ShieldAlertIcon className="w-3.5 h-3.5 text-[#d9a441]" />
                  </span>
                )}
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#ece6d8]">
                  {toast.title}
                </span>
                <span className="text-[#c9a45c]/40" aria-hidden="true">·</span>
                <span className="text-[10px] font-mono text-[#8f8a7e]">
                  {toast.timestamp}
                </span>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="w-8 h-8 -mr-1 text-[#8f8a7e] hover:text-[#ece6d8] rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Notification body */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-serif font-medium text-[#c9a45c] tracking-wide">
                  {toast.subtitle}
                </span>
                {isTelegram && (
                  <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-[#8f8a7e] border border-[#c9a45c]/15 px-2 py-0.5 rounded">
                    {toast.deliveredVia === 'telegram'
                      ? 'Telegram API · Sent'
                      : 'In-App Toast'}
                  </span>
                )}
              </div>

              <pre className="text-xs font-mono text-[#ece6d8] whitespace-pre-wrap leading-relaxed bg-[#0b0f17]/90 border border-[#c9a45c]/14 rounded-lg p-3">
                {toast.body}
              </pre>

              {isTelegram && showFocusButton && onFocusApproval && (
                <div className="flex items-center justify-end pt-1">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      onFocusApproval();
                      onDismiss();
                    }}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-[#c9a45c] hover:bg-[#e6c98a] text-[#0b0f17] shadow-[0_2px_12px_rgba(201,164,92,0.3)] transition-colors cursor-pointer"
                  >
                    <DiamondOrnament className="w-2.5 h-2.5 fill-current" />
                    <span>Review &amp; Approve Fix</span>
                    <ArrowDownRightIcon className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
