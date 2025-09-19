import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

// Configuration for theme behavior
const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

// Radio operator color palette based on existing CSS variables
const colors = {
  radio: {
    // Background colors
    primary: '#0f172a',    // --bg-primary
    secondary: '#1e293b',  // --bg-secondary
    tertiary: '#334155',   // --bg-tertiary

    // Text colors
    text: {
      primary: '#f1f5f9',   // --text-primary
      secondary: '#cbd5e1', // --text-secondary
      muted: '#64748b',     // --text-muted
    },

    // Border and accent colors
    border: '#334155',      // --border-color
    accent: {
      primary: '#3b82f6',   // --accent-primary (blue)
      success: '#10b981',   // --accent-success (green)
      warning: '#f59e0b',   // --accent-warning (amber)
      danger: '#ef4444',    // --accent-danger (red)
      info: '#06b6d4',      // --accent-info (cyan)
    }
  }
};

// Custom component styles
const components = {
  Button: {
    baseStyle: {
      fontWeight: 'medium',
      borderRadius: 'md',
      transition: 'all 0.2s',
    },
    variants: {
      primary: {
        bg: 'radio.accent.primary',
        color: 'white',
        _hover: {
          bg: 'blue.700',
          _disabled: {
            bg: 'radio.accent.primary',
          },
        },
        _active: {
          bg: 'blue.800',
        },
      },
      secondary: {
        bg: 'radio.tertiary',
        color: 'radio.text.primary',
        _hover: {
          bg: 'gray.600',
          _disabled: {
            bg: 'radio.tertiary',
          },
        },
      },
      success: {
        bg: 'radio.accent.success',
        color: 'white',
        _hover: {
          bg: 'green.700',
        },
      },
      warning: {
        bg: 'radio.accent.warning',
        color: 'white',
        _hover: {
          bg: 'yellow.600',
        },
      },
      danger: {
        bg: 'radio.accent.danger',
        color: 'white',
        _hover: {
          bg: 'red.700',
        },
      },
      ghost: {
        bg: 'transparent',
        color: 'radio.text.primary',
        _hover: {
          bg: 'radio.tertiary',
        },
      },
    },
    defaultProps: {
      variant: 'primary',
    },
  },

  Card: {
    baseStyle: {
      container: {
        bg: 'radio.secondary',
        borderColor: 'radio.border',
        borderWidth: '1px',
        borderRadius: 'lg',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      },
    },
  },

  Input: {
    baseStyle: {
      field: {
        bg: 'radio.tertiary',
        borderColor: 'radio.border',
        color: 'radio.text.primary',
        _placeholder: {
          color: 'radio.text.muted',
        },
        _hover: {
          borderColor: 'gray.500',
        },
        _focus: {
          borderColor: 'radio.accent.primary',
          boxShadow: '0 0 0 1px var(--chakra-colors-radio-accent-primary)',
        },
      },
    },
  },

  Select: {
    baseStyle: {
      field: {
        bg: 'radio.tertiary',
        borderColor: 'radio.border',
        color: 'radio.text.primary',
        _hover: {
          borderColor: 'gray.500',
        },
        _focus: {
          borderColor: 'radio.accent.primary',
          boxShadow: '0 0 0 1px var(--chakra-colors-radio-accent-primary)',
        },
      },
    },
  },

  Textarea: {
    baseStyle: {
      bg: 'radio.tertiary',
      borderColor: 'radio.border',
      color: 'radio.text.primary',
      _placeholder: {
        color: 'radio.text.muted',
      },
      _hover: {
        borderColor: 'gray.500',
      },
      _focus: {
        borderColor: 'radio.accent.primary',
        boxShadow: '0 0 0 1px var(--chakra-colors-radio-accent-primary)',
      },
    },
  },

  Table: {
    variants: {
      radio: {
        table: {
          color: 'radio.text.primary',
        },
        thead: {
          bg: 'radio.tertiary',
        },
        th: {
          borderColor: 'radio.border',
          color: 'radio.text.secondary',
        },
        td: {
          borderColor: 'radio.border',
        },
        tbody: {
          tr: {
            _even: {
              bg: 'radio.secondary',
            },
            _hover: {
              bg: 'radio.tertiary',
            },
          },
        },
      },
    },
    defaultProps: {
      variant: 'radio',
    },
  },

  Badge: {
    baseStyle: {
      color: 'white',
      fontWeight: 'medium',
    },
    variants: {
      primary: {
        bg: 'radio.accent.primary',
      },
      success: {
        bg: 'radio.accent.success',
      },
      warning: {
        bg: 'radio.accent.warning',
      },
      danger: {
        bg: 'radio.accent.danger',
      },
      info: {
        bg: 'radio.accent.info',
      },
    },
  },

  Alert: {
    variants: {
      subtle: {
        container: {
          bg: 'radio.secondary',
          borderColor: 'radio.border',
          borderWidth: '1px',
        },
        icon: {
          color: 'radio.accent.primary',
        },
      },
    },
  },

  Modal: {
    baseStyle: {
      overlay: {
        bg: 'blackAlpha.600',
      },
      dialog: {
        bg: 'radio.secondary',
        borderColor: 'radio.border',
        borderWidth: '1px',
        boxShadow: 'xl',
      },
      header: {
        color: 'radio.text.primary',
        borderBottomColor: 'radio.border',
      },
      body: {
        color: 'radio.text.primary',
      },
      footer: {
        borderTopColor: 'radio.border',
      },
    },
  },

  Menu: {
    baseStyle: {
      list: {
        bg: 'radio.secondary',
        borderColor: 'radio.border',
        borderWidth: '1px',
        boxShadow: 'lg',
      },
      item: {
        bg: 'transparent',
        color: 'radio.text.primary',
        _hover: {
          bg: 'radio.tertiary',
        },
        _focus: {
          bg: 'radio.tertiary',
        },
      },
    },
  },

  Tooltip: {
    baseStyle: {
      bg: 'radio.tertiary',
      color: 'radio.text.primary',
      borderColor: 'radio.border',
      borderWidth: '1px',
      boxShadow: 'md',
    },
  },
};

// Global styles
const styles = {
  global: {
    body: {
      bg: 'radio.primary',
      color: 'radio.text.primary',
      fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`,
    },
    // Custom scrollbar styling
    '*::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '*::-webkit-scrollbar-track': {
      bg: 'radio.secondary',
    },
    '*::-webkit-scrollbar-thumb': {
      bg: 'radio.tertiary',
      borderRadius: '4px',
      _hover: {
        bg: 'radio.text.muted',
      },
    },
  },
};

// Font configuration
const fonts = {
  heading: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`,
  body: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`,
  mono: `source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace`,
};

// Breakpoints for responsive design
const breakpoints = {
  base: '0em',    // 0px
  sm: '30em',     // ~480px
  md: '48em',     // ~768px
  lg: '62em',     // ~992px
  xl: '80em',     // ~1280px
  '2xl': '96em',  // ~1536px
};

// Create the theme
const radioTheme = extendTheme({
  config,
  colors,
  components,
  styles,
  fonts,
  breakpoints,
});

export default radioTheme;