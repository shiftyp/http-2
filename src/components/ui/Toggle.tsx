import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false
}) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className={`
          block w-12 h-6 rounded-full transition-colors
          ${checked ? 'bg-green-600' : 'bg-gray-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}>
          <div className={`
            absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-transform
            ${checked ? 'transform translate-x-6' : ''}
          `} />
        </div>
      </div>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
};