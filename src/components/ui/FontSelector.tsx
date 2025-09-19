import React, { useState, useRef, useEffect } from 'react';

interface FontSelectorProps {
  value: string;
  onChange: (font: string) => void;
  label?: string;
  disabled?: boolean;
}

const webSafeFonts = [
  { name: 'System UI', value: 'system-ui, -apple-system, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { name: 'Impact', value: 'Impact, sans-serif' },
  { name: 'Comic Sans MS', value: '"Comic Sans MS", cursive' }
];

const fontWeights = [
  { name: 'Thin', value: '100' },
  { name: 'Extra Light', value: '200' },
  { name: 'Light', value: '300' },
  { name: 'Normal', value: '400' },
  { name: 'Medium', value: '500' },
  { name: 'Semi Bold', value: '600' },
  { name: 'Bold', value: '700' },
  { name: 'Extra Bold', value: '800' },
  { name: 'Black', value: '900' }
];

const fontSizes = [
  { name: 'Extra Small', value: '0.75rem' },
  { name: 'Small', value: '0.875rem' },
  { name: 'Base', value: '1rem' },
  { name: 'Large', value: '1.125rem' },
  { name: 'Extra Large', value: '1.25rem' },
  { name: '2X Large', value: '1.5rem' },
  { name: '3X Large', value: '1.875rem' },
  { name: '4X Large', value: '2.25rem' }
];

export interface FontConfig {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
}

interface FontSelectorExtendedProps {
  value: FontConfig;
  onChange: (config: FontConfig) => void;
  label?: string;
  disabled?: boolean;
}

export const FontSelector: React.FC<FontSelectorProps> = ({
  value,
  onChange,
  label,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleFontSelect = (fontValue: string) => {
    onChange(fontValue);
    setIsOpen(false);
  };

  const currentFont = webSafeFonts.find(font => font.value === value);
  const displayName = currentFont ? currentFont.name : value || 'Select Font';

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-300">{label}</label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-left flex justify-between items-center hover:border-gray-500 focus:border-blue-500 disabled:opacity-50"
          style={{ fontFamily: value || 'inherit' }}
        >
          <span className="truncate">{displayName}</span>
          <span className="ml-2 text-gray-400">▼</span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
            {webSafeFonts.map((font) => (
              <button
                key={font.value}
                type="button"
                onClick={() => handleFontSelect(font.value)}
                className="w-full px-3 py-2 text-left hover:bg-gray-700 text-white border-b border-gray-700 last:border-b-0"
                style={{ fontFamily: font.value }}
              >
                {font.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const FontSelectorExtended: React.FC<FontSelectorExtendedProps> = ({
  value,
  onChange,
  label,
  disabled = false
}) => {
  const updateFont = (key: keyof FontConfig, newValue: string) => {
    onChange({
      ...value,
      [key]: newValue
    });
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-gray-300">{label}</label>
      )}

      <div className="grid grid-cols-1 gap-3">
        <FontSelector
          value={value.fontFamily || ''}
          onChange={(fontFamily) => updateFont('fontFamily', fontFamily)}
          label="Font Family"
          disabled={disabled}
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Font Size</label>
          <select
            value={value.fontSize || '1rem'}
            onChange={(e) => updateFont('fontSize', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white disabled:opacity-50"
          >
            {fontSizes.map((size) => (
              <option key={size.value} value={size.value}>
                {size.name} ({size.value})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Font Weight</label>
          <select
            value={value.fontWeight || '400'}
            onChange={(e) => updateFont('fontWeight', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white disabled:opacity-50"
          >
            {fontWeights.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.name} ({weight.value})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Line Height</label>
            <input
              type="text"
              value={value.lineHeight || ''}
              onChange={(e) => updateFont('lineHeight', e.target.value)}
              placeholder="1.5 or 24px"
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Letter Spacing</label>
            <input
              type="text"
              value={value.letterSpacing || ''}
              onChange={(e) => updateFont('letterSpacing', e.target.value)}
              placeholder="normal or 1px"
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Font Preview */}
      <div className="p-3 bg-gray-900 border border-gray-600 rounded">
        <div className="text-xs text-gray-400 mb-1">Preview:</div>
        <div
          style={{
            fontFamily: value.fontFamily || 'inherit',
            fontSize: value.fontSize || 'inherit',
            fontWeight: value.fontWeight || 'inherit',
            lineHeight: value.lineHeight || 'inherit',
            letterSpacing: value.letterSpacing || 'inherit'
          }}
          className="text-white"
        >
          The quick brown fox jumps over the lazy dog
        </div>
      </div>
    </div>
  );
};

export default FontSelector;