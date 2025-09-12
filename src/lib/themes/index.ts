export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    border: string;
  };
  fonts: {
    body: string;
    heading: string;
    mono: string;
  };
  sizes: {
    borderRadius: string;
    spacing: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
  custom?: Record<string, any>;
}

export const themes: Record<string, Theme> = {
  // Classic green terminal theme
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    description: 'Classic green phosphor CRT terminal',
    colors: {
      primary: '#00ff00',
      secondary: '#00aa00',
      accent: '#00ffaa',
      background: '#000000',
      surface: '#0a0a0a',
      text: '#00ff00',
      textMuted: '#008800',
      success: '#00ff00',
      warning: '#ffaa00',
      danger: '#ff0000',
      info: '#00ffff',
      border: '#00ff00'
    },
    fonts: {
      body: 'monospace',
      heading: 'monospace',
      mono: 'monospace'
    },
    sizes: {
      borderRadius: '0px',
      spacing: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '16px',
        xl: '32px'
      }
    },
    custom: {
      textShadow: '0 0 5px currentColor',
      scanlines: true
    }
  },

  // Amber CRT theme
  amber: {
    id: 'amber',
    name: 'Amber CRT',
    description: 'Classic amber monochrome monitor',
    colors: {
      primary: '#ffb000',
      secondary: '#cc8800',
      accent: '#ffd700',
      background: '#1a0f00',
      surface: '#2a1a00',
      text: '#ffb000',
      textMuted: '#aa7700',
      success: '#00ff00',
      warning: '#ffff00',
      danger: '#ff4444',
      info: '#00aaff',
      border: '#ffb000'
    },
    fonts: {
      body: 'monospace',
      heading: 'monospace',
      mono: 'monospace'
    },
    sizes: {
      borderRadius: '0px',
      spacing: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '16px',
        xl: '32px'
      }
    },
    custom: {
      textShadow: '0 0 3px currentColor'
    }
  },

  // Military/tactical theme
  military: {
    id: 'military',
    name: 'Military Tactical',
    description: 'Military-grade tactical display',
    colors: {
      primary: '#4ade80',
      secondary: '#22c55e',
      accent: '#86efac',
      background: '#0f1f1a',
      surface: '#1a2f26',
      text: '#e5e7eb',
      textMuted: '#9ca3af',
      success: '#4ade80',
      warning: '#fbbf24',
      danger: '#ef4444',
      info: '#3b82f6',
      border: '#374151'
    },
    fonts: {
      body: 'system-ui, -apple-system, sans-serif',
      heading: 'system-ui, -apple-system, sans-serif',
      mono: 'Consolas, Monaco, monospace'
    },
    sizes: {
      borderRadius: '2px',
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '20px',
        xl: '32px'
      }
    }
  },

  // Ham radio classic
  hamRadio: {
    id: 'hamRadio',
    name: 'Ham Radio Classic',
    description: 'Traditional ham radio equipment aesthetic',
    colors: {
      primary: '#00ff88',
      secondary: '#00cc66',
      accent: '#ffcc00',
      background: '#1a1a1a',
      surface: '#2a2a2a',
      text: '#00ff88',
      textMuted: '#888888',
      success: '#00ff00',
      warning: '#ffaa00',
      danger: '#ff0000',
      info: '#00aaff',
      border: '#444444'
    },
    fonts: {
      body: "'Courier New', monospace",
      heading: "'Courier New', monospace",
      mono: "'Courier New', monospace"
    },
    sizes: {
      borderRadius: '4px',
      spacing: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '16px',
        xl: '24px'
      }
    },
    custom: {
      lcdEffect: true,
      metalTexture: true
    }
  },

  // Modern dark theme
  modernDark: {
    id: 'modernDark',
    name: 'Modern Dark',
    description: 'Modern dark interface with blue accents',
    colors: {
      primary: '#3b82f6',
      secondary: '#1e40af',
      accent: '#60a5fa',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#06b6d4',
      border: '#334155'
    },
    fonts: {
      body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: "'SF Mono', Monaco, Consolas, monospace"
    },
    sizes: {
      borderRadius: '8px',
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '40px'
      }
    }
  },

  // High contrast accessibility theme
  highContrast: {
    id: 'highContrast',
    name: 'High Contrast',
    description: 'Maximum contrast for accessibility',
    colors: {
      primary: '#ffffff',
      secondary: '#cccccc',
      accent: '#ffff00',
      background: '#000000',
      surface: '#000000',
      text: '#ffffff',
      textMuted: '#cccccc',
      success: '#00ff00',
      warning: '#ffff00',
      danger: '#ff0000',
      info: '#00ffff',
      border: '#ffffff'
    },
    fonts: {
      body: 'Arial, sans-serif',
      heading: 'Arial Black, sans-serif',
      mono: 'Consolas, monospace'
    },
    sizes: {
      borderRadius: '0px',
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '20px',
        xl: '32px'
      }
    }
  },

  // Cyberpunk theme
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon-lit future aesthetic',
    colors: {
      primary: '#ff00ff',
      secondary: '#00ffff',
      accent: '#ffff00',
      background: '#0a0014',
      surface: '#1a0028',
      text: '#ff00ff',
      textMuted: '#aa00aa',
      success: '#00ff00',
      warning: '#ffaa00',
      danger: '#ff0044',
      info: '#00aaff',
      border: '#ff00ff'
    },
    fonts: {
      body: "'Orbitron', monospace",
      heading: "'Orbitron', monospace",
      mono: "'Fira Code', monospace"
    },
    sizes: {
      borderRadius: '0px',
      spacing: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '16px',
        xl: '32px'
      }
    },
    custom: {
      glowEffect: true,
      neonBorders: true,
      animation: 'pulse'
    }
  },

  // Vintage radio theme
  vintage: {
    id: 'vintage',
    name: 'Vintage Radio',
    description: '1940s radio equipment style',
    colors: {
      primary: '#8b7355',
      secondary: '#6b5d54',
      accent: '#d4af37',
      background: '#2a241e',
      surface: '#3a342e',
      text: '#e8d7c3',
      textMuted: '#a09080',
      success: '#90ee90',
      warning: '#ffd700',
      danger: '#dc143c',
      info: '#87ceeb',
      border: '#5a5043'
    },
    fonts: {
      body: "'Georgia', serif",
      heading: "'Playfair Display', serif",
      mono: "'Courier', monospace"
    },
    sizes: {
      borderRadius: '6px',
      spacing: {
        xs: '3px',
        sm: '6px',
        md: '10px',
        lg: '18px',
        xl: '28px'
      }
    },
    custom: {
      woodTexture: true,
      brassAccents: true,
      vintageDials: true
    }
  }
};

export class ThemeManager {
  private currentTheme: Theme;
  private customCSS: string = '';
  private listeners: Array<(theme: Theme) => void> = [];

  constructor(initialTheme: string = 'terminal') {
    this.currentTheme = themes[initialTheme] || themes.terminal;
    this.applyTheme();
  }

  setTheme(themeId: string): void {
    const theme = themes[themeId];
    if (!theme) {
      console.error(`Theme '${themeId}' not found`);
      return;
    }

    this.currentTheme = theme;
    this.applyTheme();
    this.notifyListeners();
    
    // Save preference
    localStorage.setItem('preferred-theme', themeId);
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  getAllThemes(): Theme[] {
    return Object.values(themes);
  }

  private applyTheme(): void {
    const root = document.documentElement;
    const theme = this.currentTheme;

    // Apply color variables
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-background', theme.colors.background);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-text-muted', theme.colors.textMuted);
    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-warning', theme.colors.warning);
    root.style.setProperty('--color-danger', theme.colors.danger);
    root.style.setProperty('--color-info', theme.colors.info);
    root.style.setProperty('--color-border', theme.colors.border);

    // Apply font variables
    root.style.setProperty('--font-body', theme.fonts.body);
    root.style.setProperty('--font-heading', theme.fonts.heading);
    root.style.setProperty('--font-mono', theme.fonts.mono);

    // Apply size variables
    root.style.setProperty('--border-radius', theme.sizes.borderRadius);
    root.style.setProperty('--spacing-xs', theme.sizes.spacing.xs);
    root.style.setProperty('--spacing-sm', theme.sizes.spacing.sm);
    root.style.setProperty('--spacing-md', theme.sizes.spacing.md);
    root.style.setProperty('--spacing-lg', theme.sizes.spacing.lg);
    root.style.setProperty('--spacing-xl', theme.sizes.spacing.xl);

    // Apply custom effects
    this.applyCustomEffects();
  }

  private applyCustomEffects(): void {
    // Remove old custom styles
    const oldStyle = document.getElementById('theme-custom-styles');
    if (oldStyle) {
      oldStyle.remove();
    }

    const custom = this.currentTheme.custom;
    if (!custom) return;

    let css = '';

    // Terminal scanlines effect
    if (custom.scanlines) {
      css += `
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            transparent 50%,
            rgba(0, 255, 0, 0.03) 50%
          );
          background-size: 100% 4px;
          pointer-events: none;
          z-index: 9999;
        }
      `;
    }

    // Text shadow/glow effect
    if (custom.textShadow) {
      css += `
        body {
          text-shadow: ${custom.textShadow};
        }
      `;
    }

    // Neon glow effect
    if (custom.glowEffect) {
      css += `
        .glow {
          animation: neon-glow 1.5s ease-in-out infinite alternate;
        }
        @keyframes neon-glow {
          from { text-shadow: 0 0 10px currentColor; }
          to { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
        }
      `;
    }

    // LCD effect
    if (custom.lcdEffect) {
      css += `
        body {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          );
        }
      `;
    }

    if (css) {
      const style = document.createElement('style');
      style.id = 'theme-custom-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  createCustomTheme(theme: Partial<Theme> & { id: string; name: string }): void {
    const baseTheme = themes.terminal;
    const customTheme: Theme = {
      ...baseTheme,
      ...theme,
      colors: { ...baseTheme.colors, ...theme.colors },
      fonts: { ...baseTheme.fonts, ...theme.fonts },
      sizes: {
        ...baseTheme.sizes,
        ...theme.sizes,
        spacing: { ...baseTheme.sizes.spacing, ...theme.sizes?.spacing }
      }
    };

    themes[theme.id] = customTheme;
    
    // Save to localStorage
    const customThemes = JSON.parse(localStorage.getItem('custom-themes') || '{}');
    customThemes[theme.id] = customTheme;
    localStorage.setItem('custom-themes', JSON.stringify(customThemes));
  }

  loadCustomThemes(): void {
    const customThemes = JSON.parse(localStorage.getItem('custom-themes') || '{}');
    Object.assign(themes, customThemes);
  }

  exportTheme(themeId: string): string {
    const theme = themes[themeId];
    if (!theme) throw new Error(`Theme '${themeId}' not found`);
    return JSON.stringify(theme, null, 2);
  }

  importTheme(themeJson: string): void {
    try {
      const theme = JSON.parse(themeJson) as Theme;
      if (!theme.id || !theme.name) {
        throw new Error('Invalid theme: missing id or name');
      }
      this.createCustomTheme(theme);
    } catch (error) {
      console.error('Failed to import theme:', error);
      throw error;
    }
  }

  onThemeChange(listener: (theme: Theme) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentTheme);
    }
  }

  // Generate CSS for compression/transmission
  generateCompressedCSS(): string {
    const t = this.currentTheme;
    
    // Ultra-compact CSS using single-letter variables
    return `
:root{
--p:${t.colors.primary};
--s:${t.colors.secondary};
--a:${t.colors.accent};
--b:${t.colors.background};
--u:${t.colors.surface};
--t:${t.colors.text};
--m:${t.colors.textMuted};
--g:${t.colors.success};
--w:${t.colors.warning};
--d:${t.colors.danger};
--i:${t.colors.info};
--o:${t.colors.border};
--f:${t.fonts.body};
--h:${t.fonts.heading};
--c:${t.fonts.mono};
--r:${t.sizes.borderRadius}
}
body{background:var(--b);color:var(--t);font-family:var(--f)}
h1,h2,h3{font-family:var(--h)}
code,pre{font-family:var(--c)}
`.replace(/\s+/g, '').trim();
  }
}

// Global theme manager instance
export const themeManager = new ThemeManager();

// Auto-load saved theme on startup
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('preferred-theme');
  if (savedTheme && themes[savedTheme]) {
    themeManager.setTheme(savedTheme);
  }
  themeManager.loadCustomThemes();
}