import { useCallback } from 'react';

export const useConfetti = () => {
  const triggerConfetti = useCallback((element?: HTMLElement) => {
    // Create confetti particles
    const createConfetti = () => {
      const colors = [
        'hsl(var(--primary))',
        'hsl(var(--secondary))', 
        'hsl(var(--accent))',
        'hsl(var(--muted-foreground))'
      ];
      
      const confettiCount = 30;
      const container = element || document.body;
      
      for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '6px';
        confetti.style.height = '6px';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.borderRadius = '50%';
        confetti.style.zIndex = '9999';
        confetti.style.pointerEvents = 'none';
        
        // Random starting position
        const rect = element?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        confetti.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 100}px`;
        confetti.style.top = `${rect.top + rect.height / 2}px`;
        
        // Animation
        confetti.style.animation = `confetti-fall 2s ease-out forwards`;
        
        container.appendChild(confetti);
        
        // Remove after animation
        setTimeout(() => {
          if (confetti.parentNode) {
            confetti.parentNode.removeChild(confetti);
          }
        }, 2000);
      }
    };
    
    // Add keyframes if not already added
    if (!document.querySelector('#confetti-keyframes')) {
      const style = document.createElement('style');
      style.id = 'confetti-keyframes';
      style.textContent = `
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(200px) rotate(360deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    createConfetti();
  }, []);
  
  return { triggerConfetti };
};