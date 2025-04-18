import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('loading');

  useEffect(() => {
    // Start with a clean slate at 0%
    setProgress(0);
    
    // Simulate loading progress in smoother increments
    let progressInterval;
    const startProgress = () => {
      progressInterval = setInterval(() => {
        setProgress(prev => {
          // Cap at 95% - final jump happens when MainLayout signals ready
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 1;
        });
      }, 20); // Faster updates for smoother animation
    };
    
    // Start after a very short delay to ensure animation starts from 0
    const initialDelay = setTimeout(startProgress, 50);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(progressInterval);
    };
  }, []);

  // External trigger to complete the loading
  useEffect(() => {
    if (onComplete) {
      const handler = () => {
        // Jump to 100%
        setProgress(100);
        
        // Start transition out
        setTimeout(() => {
          setPhase('transitioning');
        }, 200);
      };
      
      // Listen for the completion signal
      window.addEventListener('loadingComplete', handler);
      
      return () => {
        window.removeEventListener('loadingComplete', handler);
      };
    }
  }, [onComplete]);

  // Handle phase transition completion
  useEffect(() => {
    if (phase === 'transitioning') {
      const timer = setTimeout(() => {
        setPhase('complete');
      }, 400);
      
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Return null when complete
  if (phase === 'complete') return null;

  return (
    <AnimatePresence>
      {phase !== 'complete' && (
        <motion.div 
          className="fixed inset-0 bg-[#15171a] z-50 flex flex-col items-center justify-center"
          animate={{ 
            opacity: phase === 'transitioning' ? 0 : 1,
            y: phase === 'transitioning' ? -10 : 0
          }}
          transition={{ 
            duration: 0.4, 
            ease: "easeInOut"
          }}
        >
          {/* Center Content */}
          <div className="flex flex-col items-center">            
            {/* Progress Bar */}
            <div className="w-64 relative">
              <div className="h-1.5 bg-[#2c2f36] rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>

            <div className="relative text-center mt-6">
              <p className="text-white/70 text-center font-medium text-xs mb-1">Loading the TailHost Dashboard..</p>
              <p className="text-white/50 text-center text-xs">&copy; 2025 TailHost UK & Ireland.</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
