import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  className = ''
}) => {
  const variantClasses = {
    info: 'bg-blue-900/50 border-blue-600 text-blue-200',
    success: 'bg-green-900/50 border-green-600 text-green-200',
    warning: 'bg-yellow-900/50 border-yellow-600 text-yellow-200',
    danger: 'bg-red-900/50 border-red-600 text-red-200'
  };

  return (
    <div className={`
      ${variantClasses[variant]}
      border rounded-lg p-4
      ${className}
    `}>
      {children}
    </div>
  );
};