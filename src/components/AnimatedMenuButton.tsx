import React, { useState } from 'react';
import { motion } from 'motion/react';

interface AnimatedMenuButtonProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
  label?: string;
}

/**
 * 21st.dev aesthetic 3-line hairline hamburger icon button
 * Engineered with Framer Motion for graceful morphing, line-length animation on hover,
 * and delicate gold control-room styling.
 */
export const AnimatedMenuButton: React.FC<AnimatedMenuButtonProps> = ({
  isOpen,
  onClick,
  className = '',
  label = 'Toggle navigation menu'
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      aria-label={label}
      aria-expanded={isOpen}
      className={`relative min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-[#111723] hover:bg-[#c9a45c]/10 border border-[#c9a45c]/25 hover:border-[#c9a45c]/50 text-[#ece6d8] flex flex-col items-center justify-center gap-[5px] transition-colors cursor-pointer shadow-[inset_0_0_0_1px_rgba(201,164,92,0.06),0_4px_12px_rgba(0,0,0,0.4)] ${className}`}
    >
      {/* Top Hairline */}
      <motion.span
        className="block h-[1.5px] bg-[#c9a45c] rounded-full origin-center"
        animate={{
          width: 20,
          rotate: isOpen ? 45 : 0,
          y: isOpen ? 6.5 : 0
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Middle Hairline (Asymmetric 14px expanding to 20px on hover, vanishing on open) */}
      <motion.span
        className="block h-[1.5px] bg-[#c9a45c] rounded-full origin-left"
        animate={{
          width: isOpen ? 0 : isHovered ? 20 : 13,
          opacity: isOpen ? 0 : 1
        }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />

      {/* Bottom Hairline */}
      <motion.span
        className="block h-[1.5px] bg-[#c9a45c] rounded-full origin-center"
        animate={{
          width: 20,
          rotate: isOpen ? -45 : 0,
          y: isOpen ? -6.5 : 0
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.button>
  );
};
