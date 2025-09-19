import React, { useState } from 'react';

interface SpacingValue {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  all?: string;
}

interface SpacingControlsProps {
  value: SpacingValue | string;
  onChange: (value: string) => void;
  label?: string;
  type?: 'padding' | 'margin';
  disabled?: boolean;
}

const presetValues = [
  { label: 'None', value: '0' },
  { label: 'XS', value: '0.25rem' },
  { label: 'SM', value: '0.5rem' },
  { label: 'MD', value: '1rem' },
  { label: 'LG', value: '1.5rem' },
  { label: 'XL', value: '2rem' },
  { label: '2XL', value: '3rem' }
];

export const SpacingControls: React.FC<SpacingControlsProps> = ({
  value,
  onChange,
  label,
  type = 'padding',
  disabled = false
}) => {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [spacingValues, setSpacingValues] = useState<SpacingValue>(() => {
    if (typeof value === 'string') {
      const parts = value.split(' ').filter(Boolean);
      if (parts.length === 1) {
        return { all: parts[0] };
      } else if (parts.length === 2) {
        return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
      } else if (parts.length === 4) {
        return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
      }
    }
    return { all: '0' };
  });

  const updateSpacing = (newValues: SpacingValue) => {
    setSpacingValues(newValues);

    if (mode === 'simple' && newValues.all !== undefined) {
      onChange(newValues.all);
    } else {
      const { top = '0', right = '0', bottom = '0', left = '0' } = newValues;
      if (top === right && right === bottom && bottom === left) {
        onChange(top);
      } else if (top === bottom && right === left) {
        onChange(`${top} ${right}`);
      } else {
        onChange(`${top} ${right} ${bottom} ${left}`);
      }
    }
  };

  const handlePresetClick = (presetValue: string) => {
    if (mode === 'simple') {
      updateSpacing({ all: presetValue });
    } else {
      updateSpacing({
        top: presetValue,
        right: presetValue,
        bottom: presetValue,
        left: presetValue
      });
    }
  };

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">{label}</label>
          <div className="flex bg-gray-700 rounded p-1">
            <button
              type="button"
              onClick={() => setMode('simple')}
              className={`px-2 py-1 text-xs rounded ${
                mode === 'simple'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setMode('advanced')}
              className={`px-2 py-1 text-xs rounded ${
                mode === 'advanced'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Advanced
            </button>
          </div>
        </div>
      )}

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1">
        {presetValues.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetClick(preset.value)}
            disabled={disabled}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {mode === 'simple' ? (
        <div>
          <input
            type="text"
            value={spacingValues.all || ''}
            onChange={(e) => updateSpacing({ all: e.target.value })}
            placeholder="e.g., 1rem, 16px, 0.5em"
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {/* Top */}
          <div className="col-start-2">
            <label className="block text-xs text-gray-400 mb-1">Top</label>
            <input
              type="text"
              value={spacingValues.top || ''}
              onChange={(e) => updateSpacing({ ...spacingValues, top: e.target.value })}
              placeholder="0"
              disabled={disabled}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
            />
          </div>

          {/* Left */}
          <div className="col-start-1 row-start-2">
            <label className="block text-xs text-gray-400 mb-1">Left</label>
            <input
              type="text"
              value={spacingValues.left || ''}
              onChange={(e) => updateSpacing({ ...spacingValues, left: e.target.value })}
              placeholder="0"
              disabled={disabled}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
            />
          </div>

          {/* Center icon */}
          <div className="col-start-2 row-start-2 flex items-center justify-center">
            <div className="w-8 h-8 bg-gray-700 border-2 border-dashed border-gray-500 rounded flex items-center justify-center">
              <span className="text-xs text-gray-400">
                {type === 'padding' ? '📦' : '📏'}
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="col-start-3 row-start-2">
            <label className="block text-xs text-gray-400 mb-1">Right</label>
            <input
              type="text"
              value={spacingValues.right || ''}
              onChange={(e) => updateSpacing({ ...spacingValues, right: e.target.value })}
              placeholder="0"
              disabled={disabled}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
            />
          </div>

          {/* Bottom */}
          <div className="col-start-2 row-start-3">
            <label className="block text-xs text-gray-400 mb-1">Bottom</label>
            <input
              type="text"
              value={spacingValues.bottom || ''}
              onChange={(e) => updateSpacing({ ...spacingValues, bottom: e.target.value })}
              placeholder="0"
              disabled={disabled}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {/* Current value display */}
      <div className="text-xs text-gray-400">
        Current: <code className="bg-gray-800 px-1 rounded">{typeof value === 'string' ? value : JSON.stringify(value)}</code>
      </div>
    </div>
  );
};

export default SpacingControls;