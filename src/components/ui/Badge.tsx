import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md'
}) => {
  const variantClasses = {
    default: 'bg-gray-600 text-gray-100',
    primary: 'bg-blue-600 text-white',
    secondary: 'bg-gray-500 text-white',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-600 text-white',
    danger: 'bg-red-600 text-white',
    info: 'bg-cyan-600 text-white'
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-0.5 text-sm',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5'
  };

  return (
    <span className={`
      ${variantClasses[variant]}
      ${sizeClasses[size]}
      rounded-full font-medium inline-block
    `}>
      {children}
    </span>
  );
};