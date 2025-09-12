# Developer Guide - HTTP-over-Radio

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Architecture Overview](#architecture-overview)
4. [Core Components](#core-components)
5. [Building Features](#building-features)
6. [Testing Strategy](#testing-strategy)
7. [Performance Optimization](#performance-optimization)
8. [Contributing Guidelines](#contributing-guidelines)

## Getting Started

### Prerequisites

Before starting development, ensure you have:

```bash
# Required software
node --version  # v18.0.0 or higher
npm --version   # v9.0.0 or higher
git --version   # v2.0.0 or higher

# Recommended tools
Chrome/Edge browser with DevTools
VS Code with TypeScript extension
Git GUI client (optional)
```

### Initial Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/http-over-radio.git
   cd http-over-radio
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

5. **Run Tests**
   ```bash
   npm run test
   npm run test:ui  # Interactive UI
   ```

## Development Environment

### IDE Configuration

#### VS Code Settings (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "node_modules": true,
    "dist": true
  }
}
```

#### Recommended Extensions
- ESLint
- Prettier
- TypeScript Vue Plugin
- Tailwind CSS IntelliSense
- GitLens

### Development Scripts

```bash
# Development
npm run dev              # Start dev server
npm run dev:https        # Start with HTTPS

# Building
npm run build           # Production build
npm run preview         # Preview production build

# Testing
npm run test            # Run unit tests
npm run test:e2e        # Run E2E tests
npm run test:coverage   # Generate coverage report

# Code Quality
npm run lint            # Lint code
npm run typecheck       # TypeScript type checking
npm run format          # Format with Prettier
```

## Architecture Overview

### Directory Structure

```
src/
├── components/         # Reusable UI components
│   ├── ui/            # Base UI components
│   ├── radio/         # Radio-specific components
│   └── mesh/          # Mesh network components
├── pages/             # Application pages/routes
│   ├── Dashboard.tsx
│   ├── RadioOps.tsx
│   ├── ContentCreator.tsx
│   └── Settings.tsx
├── lib/               # Core libraries
│   ├── radio/         # Radio control & modulation
│   ├── http-protocol/ # HTTP protocol implementation
│   ├── mesh/          # Mesh networking (AODV)
│   ├── compression/   # JSX compression
│   ├── crypto/        # Cryptographic functions
│   ├── database/      # IndexedDB wrapper
│   ├── server-apps/   # FaaS execution
│   └── registration/  # Station registration
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
└── App.tsx            # Main application component
```

### Component Architecture

```typescript
// Component template
import React, { useState, useEffect } from 'react';
import { useRadio } from '../hooks/useRadio';

interface ComponentProps {
  prop1: string;
  prop2?: number;
  onEvent: (data: any) => void;
}

export const Component: React.FC<ComponentProps> = ({
  prop1,
  prop2 = 100,
  onEvent
}) => {
  const [state, setState] = useState<string>('');
  const { isConnected, transmit } = useRadio();

  useEffect(() => {
    // Component logic
  }, [prop1]);

  return (
    <div className="component">
      {/* Component UI */}
    </div>
  );
};
```

## Core Components

### Radio Control Integration

```typescript
import { RadioControl } from '../lib/radio';

// Initialize radio control
const radio = new RadioControl();

// Connect to radio
await radio.connect({
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
});

// Set frequency
await radio.setFrequency(14078000); // 14.078 MHz

// Transmit data
const encoder = new TextEncoder();
await radio.transmit(encoder.encode('Hello World'));

// Receive data
radio.startReceive((data) => {
  const decoder = new TextDecoder();
  console.log('Received:', decoder.decode(data));
});
```

### HTTP Protocol Implementation

```typescript
import { HTTPProtocol } from '../lib/http-protocol';

// Create protocol instance
const protocol = new HTTPProtocol({
  callsign: 'KJ4ABC',
  retryLimit: 3,
  timeout: 5000
});

// Send HTTP request
const response = await protocol.sendRequest({
  method: 'GET',
  path: '/api/weather',
  headers: {
    'Accept': 'application/json'
  }
}, 'W5XYZ');

// Handle incoming requests
protocol.onRequest(async (request, respond) => {
  // Process request
  const result = await processRequest(request);
  
  // Send response
  respond({
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: result
  });
});
```

### Mesh Networking

```typescript
import { MeshNetwork } from '../lib/mesh';

// Initialize mesh network
const mesh = new MeshNetwork({
  callsign: 'KJ4ABC',
  maxHops: 7,
  beaconInterval: 60000
});

// Join network
await mesh.join();

// Send packet through mesh
await mesh.sendPacket({
  type: 'DATA',
  payload: data
}, 'W5XYZ');

// Get routing information
const routes = mesh.getRoutingTable();
const neighbors = mesh.getNeighbors();
```

### Compression System

```typescript
import { HamRadioCompressor, RadioJSXCompiler } from '../lib/compression';

// HTML compression
const compressor = new HamRadioCompressor();
const compressed = compressor.compressHTML('<h1>Hello</h1>');
console.log(`Compression ratio: ${compressed.ratio}x`);

// JSX compilation
const compiler = new RadioJSXCompiler();
const jsxCompiled = compiler.compile(
  h('div', {}, [
    h('h1', {}, 'Title'),
    h('p', {}, 'Content')
  ])
);

// Decompile
const original = compiler.decompile(jsxCompiled);
```

## Building Features

### Creating a New Page

1. **Create Page Component**
   ```typescript
   // src/pages/NewFeature.tsx
   import React from 'react';
   import { Card } from '../components/ui/Card';

   const NewFeature: React.FC = () => {
     return (
       <div className="container mx-auto px-4 py-8">
         <h1 className="text-3xl font-bold mb-6">New Feature</h1>
         <Card>
           {/* Page content */}
         </Card>
       </div>
     );
   };

   export default NewFeature;
   ```

2. **Add Route**
   ```typescript
   // src/App.tsx
   import NewFeature from './pages/NewFeature';

   <Routes>
     <Route path="/new-feature" element={<NewFeature />} />
   </Routes>
   ```

3. **Add Navigation**
   ```typescript
   // src/App.tsx
   <NavLink to="/new-feature">New Feature</NavLink>
   ```

### Creating a Custom Hook

```typescript
// src/hooks/useCustomHook.ts
import { useState, useEffect } from 'react';

export function useCustomHook(initialValue: string) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Hook logic
  }, [value]);

  const updateValue = async (newValue: string) => {
    setLoading(true);
    try {
      // Async operation
      setValue(newValue);
    } finally {
      setLoading(false);
    }
  };

  return { value, loading, updateValue };
}
```

### Adding a Server App

```typescript
// src/lib/server-apps/custom-app.ts
import { ServerApp } from './index';

export const customApp: ServerApp = {
  id: 'custom',
  path: '/api/custom',
  handler: `
    const { request, env, storage } = context;
    
    // App logic here
    const result = processRequest(request);
    
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: result
    };
  `,
  metadata: {
    author: 'KJ4ABC',
    version: '1.0.0',
    description: 'Custom server app',
    permissions: ['storage']
  }
};

// Register the app
serverAppExecutor.registerApp(customApp);
```

## Testing Strategy

### Unit Testing

```typescript
// src/lib/compression/compression.test.ts
import { describe, it, expect } from 'vitest';
import { HamRadioCompressor } from './index';

describe('HamRadioCompressor', () => {
  it('should compress HTML effectively', () => {
    const compressor = new HamRadioCompressor();
    const html = '<h1>Test</h1><p>Content</p>';
    const compressed = compressor.compressHTML(html);
    
    expect(compressed.ratio).toBeGreaterThan(2);
    expect(compressed.compressed).toBeDefined();
  });

  it('should decompress to original', () => {
    const compressor = new HamRadioCompressor();
    const html = '<h1>Test</h1>';
    const compressed = compressor.compressHTML(html);
    const decompressed = compressor.decompressHTML(compressed);
    
    expect(decompressed).toBe(html);
  });
});
```

### Integration Testing

```typescript
// tests/integration/radio.test.ts
import { RadioControl } from '../../src/lib/radio';
import { HTTPProtocol } from '../../src/lib/http-protocol';

describe('Radio Integration', () => {
  it('should transmit and receive HTTP packets', async () => {
    const radio = new RadioControl();
    const protocol = new HTTPProtocol();
    
    // Setup mock serial port
    const mockPort = createMockSerialPort();
    await radio.connect(mockPort);
    
    // Test transmission
    const response = await protocol.sendRequest({
      method: 'GET',
      path: '/test'
    }, 'TEST');
    
    expect(response.status).toBe(200);
  });
});
```

### E2E Testing

```typescript
// tests/e2e/app.spec.ts
import { test, expect } from '@playwright/test';

test('should create and transmit content', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:3000');
  
  // Enter callsign
  await page.goto('/settings');
  await page.fill('input[name="callsign"]', 'KJ4ABC');
  await page.click('button:has-text("Save")');
  
  // Create content
  await page.goto('/content');
  await page.click('button:has-text("New Page")');
  await page.fill('input[name="title"]', 'Test Page');
  await page.fill('textarea', '# Hello World');
  await page.click('button:has-text("Save")');
  
  // Verify creation
  await expect(page.locator('text=Test Page')).toBeVisible();
});
```

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
const RadioOps = lazy(() => import('./pages/RadioOps'));
const ContentCreator = lazy(() => import('./pages/ContentCreator'));

// Use Suspense for loading state
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/radio" element={<RadioOps />} />
    <Route path="/content" element={<ContentCreator />} />
  </Routes>
</Suspense>
```

### Memoization

```typescript
// Memoize expensive computations
const compressionRatio = useMemo(() => {
  return calculateCompressionRatio(original, compressed);
}, [original, compressed]);

// Memoize components
const ExpensiveComponent = memo(({ data }) => {
  return <div>{/* Complex rendering */}</div>;
});
```

### IndexedDB Optimization

```typescript
// Batch operations
const batchSave = async (items: any[]) => {
  const tx = db.transaction(['store'], 'readwrite');
  const store = tx.objectStore('store');
  
  for (const item of items) {
    store.put(item);
  }
  
  await tx.complete;
};

// Use indexes for queries
const index = store.index('by_timestamp');
const recent = await index.getAll(IDBKeyRange.lowerBound(cutoff));
```

### Web Worker Usage

```typescript
// Offload heavy computations
const worker = new Worker('/workers/compression.js');

worker.postMessage({
  type: 'compress',
  data: largeContent
});

worker.onmessage = (event) => {
  const compressed = event.data;
  // Use compressed data
};
```

## Contributing Guidelines

### Code Style

```typescript
// Use TypeScript strict mode
// Prefer const over let
// Use async/await over promises
// Add JSDoc comments for public APIs

/**
 * Compresses HTML content for radio transmission
 * @param html - The HTML string to compress
 * @returns Compressed payload with metadata
 */
export function compressHTML(html: string): CompressedPayload {
  // Implementation
}
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature

- Implement X functionality
- Add Y component
- Update Z documentation"

# Push and create PR
git push origin feature/new-feature
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console errors
```

### Review Process

1. **Code Review Checklist**
   - TypeScript types correct
   - Error handling present
   - Performance considered
   - Security reviewed
   - Documentation updated

2. **Testing Requirements**
   - All tests passing
   - Coverage maintained >80%
   - E2E scenarios covered

3. **Merge Criteria**
   - 2 approvals required
   - CI/CD checks passing
   - No merge conflicts

## Debugging Tips

### Browser DevTools

```javascript
// Use conditional breakpoints
if (packet.type === 'ERROR') {
  debugger;
}

// Performance profiling
console.time('compression');
const compressed = compress(data);
console.timeEnd('compression');

// Network inspection
window.__HTTP_RADIO_DEBUG__ = true; // Enable debug mode
```

### Radio Debugging

```typescript
// Enable verbose logging
const radio = new RadioControl({ debug: true });

// Monitor serial traffic
radio.on('raw', (data) => {
  console.log('Serial:', data);
});

// Simulate radio without hardware
const mockRadio = new MockRadioControl();
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Serial port access denied | Run Chrome with `--enable-experimental-web-platform-features` |
| IndexedDB quota exceeded | Clear browser storage or increase quota |
| Service Worker not updating | Hard refresh (Ctrl+Shift+R) or unregister SW |
| TypeScript errors | Run `npm run typecheck` for details |

---

*Document Version: 1.0.0*  
*Last Updated: 2024*  
*Status: Active Development*