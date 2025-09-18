# Testing Strategy for Server CQ Storage

## Testing Philosophy

Following TDD and constitutional principles, we use **minimal mocking** - only mock truly external dependencies.

### What We DON'T Mock (Use Real Implementations)
- ✅ **SQLite Database** - Use in-memory (`:memory:`) for speed and isolation
- ✅ **Express App** - Test real HTTP endpoints with supertest
- ✅ **ContentRegistry Service** - Use actual consolidation logic
- ✅ **Models** - Real validation and business logic
- ✅ **Middleware** - Real rate limiting, authentication logic

### What We DO Mock (External Dependencies Only)
- ⚠️ **WebSocket connections** - Mock external WebSocket clients
- ⚠️ **Network calls** - Mock external HTTP requests (if any)
- ⚠️ **File system** - Mock file I/O for tests (if needed)
- ⚠️ **External APIs** - Mock third-party services

## Test Categories

### Contract Tests (`/tests/contract`)
- Test API contracts match OpenAPI specification
- Use real Express app with in-memory database
- Verify request/response schemas
- No mocking of internal services

### Integration Tests (`/tests/integration`)
- Test service interactions
- Use real database and services
- Mock only external network connections
- Verify business logic and data flow

### Unit Tests (`/tests/unit`)
- Test individual functions
- Minimal mocking (only for isolation)
- Focus on algorithms (path consolidation, scoring)

## Example: Proper External Mocking

```javascript
// ❌ WRONG - Mocking internal service
vi.mock('../services/ContentRegistry', () => ({
  default: vi.fn() // Don't do this!
}));

// ✅ CORRECT - Mocking external WebSocket
vi.mock('ws', () => ({
  default: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    on: vi.fn()
  }))
}));

// ✅ CORRECT - Using real in-memory database
const db = new Database(':memory:');
await db.initialize();
```

## Running Tests

```bash
# Run all tests (contract → integration → unit)
npm test

# Run specific category
npm run test:contract
npm run test:integration
npm run test:unit

# Watch mode for development
npm run test:watch
```

## TDD Cycle Verification

1. **RED Phase**: Tests written first, must fail
   - Contract tests fail with 404 (no endpoints)
   - Integration tests fail with missing services

2. **GREEN Phase**: Implement to make tests pass
   - Add real implementations
   - Use actual business logic

3. **REFACTOR Phase**: Optimize while keeping tests green
   - Improve algorithms
   - Add caching
   - Enhance performance

## Performance Testing

Tests verify performance requirements:
- Hash lookups < 100ms (measured with real database)
- Path consolidation achieves 80% reduction (calculated with real data)
- Storage limits enforced (tested with real eviction)

## Constitutional Compliance

- **Test-First Development**: Tests always written before implementation
- **Real Dependencies**: Use actual databases, not mocks
- **No Over-Mocking**: Only mock external services
- **Observability**: Tests verify logging and error context