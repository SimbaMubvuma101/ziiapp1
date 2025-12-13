import React from 'react';

interface LoaderProps {
  size?: number;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 24, className = "" }) => {
  return (
    <svg 
      viewBox="0 0 24 24" 
      width={size}
      height={size}
      className={`animate-spin ${className}`}
      style={{ animationDuration: '2s' }}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M4 4L20 4L4 20L20 20" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
};