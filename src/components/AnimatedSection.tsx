import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const AnimatedSection: React.FC<Props> = ({ children, className = "", delay = 0 }) => {
  return (
    <div 
      className={`animate-in fade-in slide-in-from-bottom-4 duration-700 ${className}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      {children}
    </div>
  );
};

export default AnimatedSection;