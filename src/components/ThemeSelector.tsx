import React, { useState, useEffect } from 'react';
import { themeManager, Theme } from '../lib/themes';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

export const ThemeSelector: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themeManager.getTheme());
  const [themes, setThemes] = useState<Theme[]>(themeManager.getAllThemes());
  const [customizing, setCustomizing] = useState(false);
  const [customTheme, setCustomTheme] = useState<Partial<Theme>>({});

  useEffect(() => {
    const unsubscribe = themeManager.onThemeChange((theme) => {
      setCurrentTheme(theme);
    });
    return unsubscribe;
  }, []);

  const handleThemeChange = (themeId: string) => {
    themeManager.setTheme(themeId);
  };

  const handleColorChange = (colorKey: string, value: string) => {
    setCustomTheme(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorKey]: value
      }
    }));
  };

  const saveCustomTheme = () => {
    const id = `custom_${Date.now()}`;
    const name = prompt('Enter theme name:') || 'Custom Theme';
    
    themeManager.createCustomTheme({
      ...currentTheme,
      ...customTheme,
      id,
      name,
      description: 'User-created custom theme'
    } as Theme);
    
    themeManager.setTheme(id);
    setThemes(themeManager.getAllThemes());
    setCustomizing(false);
    setCustomTheme({});
  };

  const exportTheme = () => {
    const json = themeManager.exportTheme(currentTheme.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTheme.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTheme = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        themeManager.importTheme(e.target?.result as string);
        setThemes(themeManager.getAllThemes());
        alert('Theme imported successfully!');
      } catch (error) {
        alert('Failed to import theme: ' + error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">Theme Settings</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Select
            label="Select Theme"
            value={currentTheme.id}
            onChange={(e) => handleThemeChange(e.target.value)}
            options={themes.map(t => ({
              value: t.id,
              label: `${t.name} - ${t.description}`
            }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Preview</h3>
              <div 
                className="p-4 rounded border"
                style={{
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text
                }}
              >
                <h4 style={{ color: currentTheme.colors.primary }}>Primary Text</h4>
                <p style={{ color: currentTheme.colors.textMuted }}>Muted text example</p>
                <div className="flex gap-2 mt-2">
                  <span style={{ color: currentTheme.colors.success }}>Success</span>
                  <span style={{ color: currentTheme.colors.warning }}>Warning</span>
                  <span style={{ color: currentTheme.colors.danger }}>Danger</span>
                  <span style={{ color: currentTheme.colors.info }}>Info</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Color Palette</h3>
              <div className="grid grid-cols-6 gap-1">
                {Object.entries(currentTheme.colors).map(([key, color]) => (
                  <div
                    key={key}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-600"
                    style={{ backgroundColor: color }}
                    title={`${key}: ${color}`}
                    onClick={() => {
                      if (customizing) {
                        const newColor = prompt(`Enter color for ${key}:`, color);
                        if (newColor) handleColorChange(key, newColor);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {customizing && (
            <div className="space-y-2 p-4 border border-gray-600 rounded">
              <h3 className="font-semibold">Customize Colors</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(currentTheme.colors).map(([key, color]) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-sm flex-1">{key}:</label>
                    <input
                      type="color"
                      value={customTheme.colors?.[key as keyof typeof currentTheme.colors] || color}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-12 h-6"
                    />
                    <input
                      type="text"
                      value={customTheme.colors?.[key as keyof typeof currentTheme.colors] || color}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-20 px-1 text-xs bg-gray-800 border border-gray-600 rounded"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={saveCustomTheme} variant="success" size="sm">
                  Save Custom Theme
                </Button>
                <Button onClick={() => {
                  setCustomizing(false);
                  setCustomTheme({});
                }} variant="secondary" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => setCustomizing(!customizing)}
              variant="primary"
              size="sm"
            >
              {customizing ? 'Cancel Customization' : 'Customize Theme'}
            </Button>
            
            <Button
              onClick={exportTheme}
              variant="secondary"
              size="sm"
            >
              Export Theme
            </Button>
            
            <label className="btn btn-secondary btn-sm cursor-pointer">
              Import Theme
              <input
                type="file"
                accept=".json"
                onChange={importTheme}
                className="hidden"
              />
            </label>
          </div>

          <div className="text-xs text-gray-500 mt-4">
            <p>Themes are optimized for radio transmission:</p>
            <ul className="list-disc list-inside mt-1">
              <li>Compressed CSS: ~{themeManager.generateCompressedCSS().length} bytes</li>
              <li>Theme ID reference: 2-4 bytes</li>
              <li>Cached locally after first transmission</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};