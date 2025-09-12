# Revised Implementation Tasks: HTTP Over Ham Radio PWA

**Feature**: Ham Radio Progressive Web App for Digital Communication  
**Branch**: `001-web-based-application`  
**Stack**: TypeScript 5.x, React, Web Serial API, Web Audio API, IndexedDB, Workbox

## Task Organization

Tasks marked with [P] can be executed in parallel as they work on independent files.
Tasks without [P] must be executed sequentially due to shared dependencies.

## Phase 1: PWA Foundation (Sequential)

### T001: Create PWA Structure
**File**: `public/index.html`, `public/manifest.json`
- Create public directory for static files
- Setup index.html with PWA meta tags
- Create manifest.json for installability
- Add icons and splash screens

### T002: Setup Build Configuration
**File**: `vite.config.ts`, `tsconfig.json`
- Configure Vite for PWA build
- Setup TypeScript for browser target
- Configure Workbox plugin
- Setup development server with HTTPS

### T003: Create Service Worker
**File**: `src/service-worker.ts`
- Implement offline caching strategy
- Cache all static assets
- Handle offline navigation
- Setup background sync for requests

### T004: Setup IndexedDB Schema
**File**: `src/services/database/schema.ts`
- Define database schema for:
  - Signing list entries
  - HTML resources
  - Routing tables
  - Registration queue
  - Transmission logs
- Create migration system

### T005: Create Static Server
**File**: `server/server.js`
- Minimal Express server
- Serve static files only
- Serve signing list (read-only)
- HTTPS configuration for Web Serial API

## Phase 2: Core Libraries (Parallel)

### T006: Web Serial API Radio Control [P]
**File**: `src/lib/radio-control/`
- Create SerialPort wrapper
- Implement CAT command protocol
- Handle connection management
- Create mock mode for testing

### T007: Web Audio API QPSK Modem [P]
**File**: `src/lib/qpsk-modem/`
- Implement QPSK modulator in Web Audio
- Implement demodulator
- Add FEC encoding/decoding
- Create audio worklet processor

### T008: Mesh Router Library [P]
**File**: `src/lib/mesh-router/`
- Implement AODV routing protocol
- Store routes in IndexedDB
- Handle route discovery
- Implement forwarding logic

### T009: Signing List Manager [P]
**File**: `src/lib/signing-list/`
- Fetch and verify signing list
- Store in IndexedDB
- Implement Web Crypto verification
- Handle trust levels

### T010: HTTP-Radio Protocol [P]
**File**: `src/services/http-radio/`
- Encode HTTP requests for radio
- Decode received HTTP responses
- Handle fragmentation
- Implement retry logic

### T011: ORM Library [P]
**File**: `src/lib/orm/`
- Create IndexedDB ORM wrapper
- Implement query builder pattern
- Add migration system
- Support transactions and indexes
- Create TypeScript type definitions

### T012: Function Runtime [P]
**File**: `src/lib/function-runtime/`
- Create FaaS execution engine
- Implement context API (store, respond, crypto)
- Handle function isolation
- Support async handlers
- Add function versioning

## Phase 3: UI Components (Parallel)

### T013: Radio Control Component [P]
**File**: `src/components/RadioControl/RadioControl.tsx`
- Serial port selection UI
- Connection status display
- Frequency/mode controls
- PTT button

### T014: Page Editor Component [P]
**File**: `src/components/PageEditor/PageEditor.tsx`
- Markdown editor with preview
- HTML editor with syntax highlighting
- Frontmatter support
- Save to /pages/ path
- Live preview rendering

### T015: Function Editor Component [P]
**File**: `src/components/FunctionEditor/FunctionEditor.tsx`
- JavaScript code editor
- Function path configuration
- Context API autocomplete
- Test function locally
- Deploy to /functions/ path

### T016: Data Table Component [P]
**File**: `src/components/DataTable/DataTable.tsx`
- Spreadsheet-like grid interface
- Inline cell editing
- Column sorting and filtering
- CSV import/export
- Pagination controls
- Row selection
- Schema-aware editing

### T017: Database Explorer Component [P]
**File**: `src/components/DatabaseExplorer/DatabaseExplorer.tsx`
- Function database selector
- Table list with record counts
- Create/drop table UI
- Query builder interface
- Data migration tools

### T018: Mesh Network Visualizer [P]
**File**: `src/components/MeshNetwork/MeshNetwork.tsx`
- Network topology display
- Node status indicators
- Route visualization
- Link quality display

### T019: Registration Component [P]
**File**: `src/components/Registration/Registration.tsx`
- Registration form
- Queue status display
- Coordinator interface
- Verification workflow

### T020: Transmission Queue Component [P]
**File**: `src/components/TransmissionQueue/TransmissionQueue.tsx`
- Queue visualization
- Progress indicators
- Retry controls
- Error display

## Phase 4: Application Pages (Sequential)

### T021: Main Dashboard
**File**: `src/pages/Dashboard.tsx`
- Radio connection widget
- Quick status overview
- Recent activity
- Install PWA prompt

### T022: Content Creator Page
**File**: `src/pages/ContentCreator.tsx`
- Tab interface for Pages vs Functions
- Page editor (Markdown/HTML)
- Function editor (JavaScript)
- Preview panel
- Deploy controls

### T023: Database Manager Page
**File**: `src/pages/DatabaseManager.tsx`
- Function selector
- Database explorer
- Data table grid
- Query interface
- Import/export tools

### T024: Radio Operations Page
**File**: `src/pages/RadioOps.tsx`
- Full radio control interface
- Transmission controls
- Received messages log
- Signal analysis

### T025: Resource Browser Page
**File**: `src/pages/Browse.tsx`
- URL bar for callsign.radio
- Render static pages
- Execute server functions
- Form submission handling
- Cache management

### T026: Settings Page
**File**: `src/pages/Settings.tsx`
- Station configuration
- Bandwidth policies
- Trust settings
- Data management

## Phase 5: Web Workers (Parallel)

### T027: Audio Processing Worker [P]
**File**: `src/workers/modem.worker.ts`
- Offload QPSK processing
- Real-time audio processing
- FEC encoding/decoding
- Signal analysis

### T028: Function Execution Worker [P]
**File**: `src/workers/function.worker.ts`
- Execute server functions in isolation
- Provide context API (db, store, respond)
- Handle async operations
- Enforce memory/CPU limits
- Sandbox JavaScript execution

### T029: Crypto Worker [P]
**File**: `src/workers/crypto.worker.ts`
- Signature verification
- Key generation
- Hash calculations
- Certificate validation

## Phase 6: Integration (Sequential)

### T030: Wire Up Radio Control
**File**: `src/App.tsx`
- Connect Web Serial to UI
- Handle permissions
- Error boundaries
- State management

### T031: Integrate Audio Pipeline
**File**: `src/services/audio-pipeline.ts`
- Connect Web Audio to radio
- Wire up audio worklet
- Handle PTT control
- Monitor levels

### T032: Connect Content Router
**File**: `src/services/content-router.ts`
- Route /pages/* to static content
- Route /functions/* to function runtime
- Handle 404s
- Manage cache

### T033: Integrate ORM with Functions
**File**: `src/services/function-context.ts`
- Create context for each function
- Provide ORM instance
- Setup isolated database namespace
- Handle transactions

### T034: Connect Mesh Protocol
**File**: `src/services/mesh-service.ts`
- Initialize routing
- Handle incoming requests
- Process forwards
- Update topology

## Phase 7: Testing

### T035: Unit Tests [P]
**File**: `tests/unit/`
- Test ORM query builder
- Test function runtime
- Test content router
- Test data models
- Mock browser APIs

### T036: Integration Tests [P]
**File**: `tests/integration/`
- Test function execution in worker
- Test ORM with IndexedDB
- Test static vs function routing
- Test with mock serial port
- Test with mock audio
- Test service worker

### T037: E2E Tests
**File**: `tests/e2e/`
- Test PWA installation
- Test offline functionality
- Test page creation and serving
- Test function deployment and execution
- Test database operations via UI
- Test radio connection flow
- Test mesh networking

## Phase 8: PWA Features

### T038: Offline Functionality
**File**: `src/service-worker.ts`
- Cache static pages
- Cache function code
- Cache database schemas
- Test offline operation
- Background sync for radio queue

### T039: Install Experience
**File**: `src/components/InstallPrompt.tsx`
- Create install UI
- Handle beforeinstallprompt
- Track installation
- Post-install experience

### T040: Update Mechanism
**File**: `src/services/updater.ts`
- Check for updates
- Download in background
- Migrate database schemas
- Update function runtime
- Prompt for reload

## Execution Examples

### Starting Development
```bash
# Install dependencies
npm install

# Start development server with HTTPS
npm run dev:https

# Open https://localhost:3000
# Browser will prompt for Web Serial permission
```

### Building for Production
```bash
# Build PWA
npm run build

# Test production build
npm run preview

# Deploy (just serve static files)
npm run deploy
```

### Testing Offline
```bash
# Start server
npm run dev

# Visit site and install PWA
# Stop server
# PWA continues working offline
```

## Dependencies to Install

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "idb": "^8.0.0",
    "workbox-core": "^7.0.0",
    "workbox-precaching": "^7.0.0",
    "workbox-routing": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/web-serial": "^0.0.1",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.17.0",
    "vitest": "^1.0.0",
    "playwright": "^1.40.0",
    "typescript": "^5.3.0"
  }
}
```

## Success Criteria

- PWA installs and works offline
- Web Serial API connects to radio
- Web Audio API processes signals
- IndexedDB stores all data locally
- Service worker caches everything
- No server required after installation
- Works on Chrome, Edge, Opera (Web Serial support)

## Key Architecture Points

1. **No Backend API**: Everything runs in the browser
2. **Web Serial API**: Direct hardware access from browser
3. **Service Worker**: Complete offline functionality
4. **IndexedDB**: All data stored client-side
5. **Static Server**: Only serves PWA files and signing list
6. **Web Workers**: Offload heavy processing
7. **Web Crypto API**: All crypto in browser

---
*Total Tasks: 40 | Expanded to include ORM, FaaS runtime, and spreadsheet interface*