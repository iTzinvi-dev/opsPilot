import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  XIcon,
  ServerIcon,
  TerminalIcon,
  CpuIcon,
  HistoryIcon,
  CompassIcon,
  DiamondOrnament,
  PlayIcon
} from './icons';

export type SectionChunkId = 'all' | 'topology' | 'telemetry' | 'pipeline' | 'history';

export interface SectionChunkOption {
  id: SectionChunkId;
  roman: string;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
}

export const SECTION_CHUNKS: SectionChunkOption[] = [
  {
    id: 'all',
    roman: 'Master',
    name: 'Full Control Room',
    subtitle: 'Unified dual-column layout with all operational streams active',
    icon: <CompassIcon className="w-4 h-4 text-[#c9a45c]" />
  },
  {
    id: 'topology',
    roman: 'I',
    name: 'Production Topology',
    subtitle: 'Monitored microservices, cluster metrics, and failure injection',
    icon: <ServerIcon className="w-4 h-4 text-[#c9a45c]" />
  },
  {
    id: 'telemetry',
    roman: 'II',
    name: 'Live Telemetry Logs',
    subtitle: 'High-throughput terminal stream with level filtering & timestamps',
    icon: <TerminalIcon className="w-4 h-4 text-[#c9a45c]" />
  },
  {
    id: 'pipeline',
    roman: 'III',
    name: 'Autonomous 4-Agent Pipeline',
    subtitle: 'Monitor, Triage, Diagnose, Responder, Runbooks & Human Sign-off',
    icon: <CpuIcon className="w-4 h-4 text-[#c9a45c]" />
  },
  {
    id: 'history',
    roman: 'IV',
    name: 'Incident History & Audit',
    subtitle: 'Session audit ledger, MTTR resolution records & automated diagnostics',
    icon: <HistoryIcon className="w-4 h-4 text-[#c9a45c]" />
  }
];

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: SectionChunkId;
  onSelectSection: (id: SectionChunkId) => void;
  anyIncidentActive: boolean;
  onRunLiveDemo: () => void;
  demoDisabled: boolean;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  activeSection,
  onSelectSection,
  anyIncidentActive,
  onRunLiveDemo,
  demoDisabled
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-start">
          {/* Backdrop with soft ease-out fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-[#0b0f17]/85 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Navigation Drawer panel sliding from top-left */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Navigation Section Index"
            className="relative z-10 w-full max-w-sm sm:max-w-md bg-[#111723] border-r border-[#c9a45c]/20 h-full flex flex-col justify-between overflow-y-auto shadow-2xl"
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#c9a45c]/15 bg-[#0b0f17]/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0b0f17] border border-[#c9a45c]/20 flex items-center justify-center text-[#c9a45c]">
                    <DiamondOrnament className="w-4 h-4 text-[#c9a45c] fill-current" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a45c] font-medium">
                      Control Room Index
                    </p>
                    <h2 className="text-xl font-editorial font-semibold text-[#ece6d8]">
                      Page Chunks &amp; Sections
                    </h2>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation menu"
                  className="w-10 h-10 rounded-xl border border-[#c9a45c]/20 flex items-center justify-center text-[#8f8a7e] hover:text-[#ece6d8] hover:bg-[#c9a45c]/10 transition-colors cursor-pointer"
                >
                  <XIcon className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Section chunk navigation items */}
              <div className="p-6 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f8a7e] font-medium px-1">
                  Access Individual Section Chunks
                </p>

                <div className="space-y-2">
                  {SECTION_CHUNKS.map((chunk) => {
                    const isActive = activeSection === chunk.id;

                    return (
                      <motion.button
                        key={chunk.id}
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => {
                          onSelectSection(chunk.id);
                          onClose();
                        }}
                        className={`w-full text-left p-3.5 rounded-[12px] border transition-all duration-200 cursor-pointer flex items-start gap-3.5 ${
                          isActive
                            ? 'bg-[#151c2a] border-[#c9a45c]/50 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.15),0_8px_24px_-8px_rgba(201,164,92,0.2)]'
                            : 'bg-[#0b0f17]/60 hover:bg-[#141b27] border-[#c9a45c]/12 hover:border-[#c9a45c]/30'
                        }`}
                      >
                        <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#0b0f17] border border-[#c9a45c]/15 flex items-center justify-center shrink-0">
                          {chunk.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-editorial text-xs font-semibold text-[#c9a45c]">
                                {chunk.roman}.
                              </span>
                              <h3 className="font-editorial text-base font-medium text-[#ece6d8] truncate">
                                {chunk.name}
                              </h3>
                            </div>
                            {isActive && (
                              <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] font-mono text-[#7fb89a] border border-[#7fb89a]/30 px-2 py-0.5 rounded">
                                Active Chunk
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#8f8a7e] mt-1 font-light leading-relaxed">
                            {chunk.subtitle}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Actions & Status inside Drawer */}
            <div className="p-6 border-t border-[#c9a45c]/15 bg-[#0b0f17]/50 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8f8a7e] font-serif">Cluster Status:</span>
                <span
                  className={`font-mono text-[11px] flex items-center gap-1.5 ${
                    anyIncidentActive ? 'text-[#c4605a]' : 'text-[#7fb89a]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      anyIncidentActive
                        ? 'bg-[#c4605a] shadow-[0_0_6px_rgba(196,96,90,0.8)]'
                        : 'bg-[#7fb89a] shadow-[0_0_6px_rgba(127,184,154,0.7)]'
                    }`}
                  />
                  <span>{anyIncidentActive ? 'Incident Degraded' : 'Nominal 100%'}</span>
                </span>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => {
                  onRunLiveDemo();
                  onClose();
                }}
                disabled={demoDisabled}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#c9a45c] bg-[#c9a45c]/10 hover:bg-[#c9a45c]/20 text-[#ece6d8] hover:text-[#e6c98a] font-editorial text-sm tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40"
              >
                <PlayIcon className="w-3.5 h-3.5 fill-[#c9a45c]" />
                <span>Run Live Demo From Menu</span>
              </motion.button>

              <div className="text-[10px] text-center uppercase tracking-[0.2em] text-[#8f8a7e]/70 font-mono pt-1">
                OpsPilot · Autonomous SRE Architecture
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
