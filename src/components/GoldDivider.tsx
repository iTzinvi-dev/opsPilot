import React from 'react';
import { DiamondOrnament } from './icons';

interface GoldDividerProps {
  label?: string;
  className?: string;
}

export const GoldDivider: React.FC<GoldDividerProps> = ({ label, className = 'my-6' }) => {
  return (
    <div className={`flex items-center gap-3 w-full select-none ${className}`} aria-hidden="true">
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9a45c]/20 to-[#c9a45c]/35" />
      <div className="flex items-center gap-2 text-[#c9a45c] shrink-0">
        <DiamondOrnament className="w-2 h-2 text-[#c9a45c]/70 fill-current" />
        {label && (
          <span className="text-[10px] uppercase tracking-[0.2em] font-sans font-medium text-[#c9a45c]/90">
            {label}
          </span>
        )}
        {label && (
          <DiamondOrnament className="w-2 h-2 text-[#c9a45c]/70 fill-current" />
        )}
      </div>
      <div className="h-[1px] flex-1 bg-gradient-to-r from-[#c9a45c]/35 via-[#c9a45c]/20 to-transparent" />
    </div>
  );
};
