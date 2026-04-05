import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const AnimatedSection: React.FC<Props> = ({ children, className = "" }) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

export default AnimatedSection;