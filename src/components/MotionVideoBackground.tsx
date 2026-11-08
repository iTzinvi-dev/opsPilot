import React, { useEffect, useRef, useState } from 'react';

interface MotionVideoBackgroundProps {
  anyIncidentActive: boolean;
}

const VIDEO_URL =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/45567745-d826-44a2-a5ce-7ef670944e60.mp4';

/**
 * High-performance hardware-accelerated kinetic video background
 * Engineered with isolated compositor layer, visibility lifecycle listeners,
 * fallback user-interaction autoplay trigger, and adaptive luxury editorial vignette.
 */
export const MotionVideoBackground: React.FC<MotionVideoBackgroundProps> = ({
  anyIncidentActive
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  // 1. Guaranteed Autoplay Handler with Browser Interaction Fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;

    const startPlayback = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // If browser autoplay policy blocks unprompted playback, attach single-tap listener
            const handleUserTap = () => {
              if (videoRef.current) {
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
              }
              window.removeEventListener('pointerdown', handleUserTap);
              window.removeEventListener('keydown', handleUserTap);
            };
            window.addEventListener('pointerdown', handleUserTap, { once: true });
            window.addEventListener('keydown', handleUserTap, { once: true });
          });
      }
    };

    startPlayback();
  }, []);

  // 2. Lifecycle optimization: pause when tab is hidden to eliminate background lag and save CPU
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!videoRef.current) return;
      if (document.hidden) {
        videoRef.current.pause();
      } else if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying]);

  // 3. Respect prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlayback = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      style={{
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
      aria-hidden="true"
    >
      {/* 3D Kinetic Torus Alabaster Video */}
      <video
        ref={videoRef}
        src={VIDEO_URL}
        poster="/poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onLoadedData={() => setIsVideoLoaded(true)}
        className={`w-full h-full object-cover object-center transition-opacity duration-1000 ${
          isVideoLoaded ? 'opacity-70 sm:opacity-85' : 'opacity-40'
        }`}
        style={{
          filter: 'contrast(1.1) brightness(0.85) saturate(0.9)',
          transform: 'scale(1.02) translateZ(0)',
          willChange: 'transform'
        }}
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>

      {/* Radial Editorial Lighting & Vignette Overlay */}
      <div
        className="absolute inset-0 transition-all duration-700 pointer-events-none"
        style={{
          background: anyIncidentActive
            ? 'radial-gradient(circle at 50% 30%, rgba(11, 15, 23, 0.35) 0%, rgba(20, 16, 22, 0.72) 65%, #0b0f17 100%)'
            : 'radial-gradient(circle at 50% 30%, rgba(11, 15, 23, 0.25) 0%, rgba(11, 15, 23, 0.65) 65%, #0b0f17 100%)'
        }}
      />

      {/* Fine Film Grain Texture Overlay */}
      <div className="absolute inset-0 bg-film-grain opacity-35 pointer-events-none" />

      {/* Subtle Top & Bottom Linear Scrims for Nav and Footer Contrast */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0b0f17]/85 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#0b0f17]/90 to-transparent pointer-events-none" />

      {/* Interactive Unobtrusive Play/Pause Button in Bottom-Left */}
      <div className="absolute bottom-3 left-4 pointer-events-auto z-20 hidden sm:flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? 'Pause background motion video' : 'Play background motion video'}
          className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#8f8a7e] hover:text-[#ece6d8] bg-[#111723]/80 hover:bg-[#111723] border border-[#c9a45c]/25 px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm backdrop-blur-sm"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isPlaying
                ? 'bg-[#7fb89a] shadow-[0_0_6px_rgba(127,184,154,0.8)]'
                : 'bg-[#8f8a7e]'
            }`}
          />
          <span>Kinetic Motion: {isPlaying ? 'Active' : 'Paused'}</span>
        </button>
      </div>
    </div>
  );
};
