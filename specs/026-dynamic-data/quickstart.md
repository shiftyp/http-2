# Quickstart: Dynamic Data System

## Overview
The Dynamic Data system enables efficient distribution of time-sensitive updates (emergency alerts, weather data, station status) across ham radio networks using RF broadcast, WebRTC peer-to-peer transfer, and intelligent retry mechanisms.

## For Radio Operators

### Subscribing to Updates
```javascript
// Subscribe to emergency updates
await subscriptionManager.subscribe({
  channel: 'emergency.missing_person',
  stationId: 'KA1ABC'
});

// Subscribe to weather updates
await subscriptionManager.subscribe({
  channel: 'weather.alerts',
  stationId: 'KA1ABC'
});
```

### Creating Updates (Licensed Stations Only)
```javascript
// Create emergency update
const update = await updateManager.create({
  category: 'emergency',
  priority: 0, // P0 = highest
  data: 'John Smith found at City Hospital',
  subscribers: ['KB2DEF', 'KC3GHI', 'UNLICENSED-001']
});

// Update will be broadcast immediately via RF
// P0 updates rebroadcast every 5 minutes automatically
```

### Requesting Missed Updates
```javascript
// Licensed station requests retry
await retryCoordinator.requestRetry({
  updateId: 'EMRG-2024-001',
  version: 2,
  requester: 'KD4JKL',
  location: 'EM48'
});

// System coordinates retry within 10-30 seconds
// Multiple stations may respond to avoid collision
```

### Monitoring Updates
```javascript
// Check for pending updates
const pending = await updateManager.getPendingUpdates();

// View update details
const update = await updateManager.getUpdate('EMRG-2024-001');
console.log(`Priority: P${update.priority}`);
console.log(`Expires: ${update.expires}`);
```

## For Developers

### Setting Up Libraries

#### 1. Update Manager
```typescript
import { UpdateManager } from './lib/update-manager';

const manager = new UpdateManager({
  maxSize: 50 * 1024, // 50KB max
  compression: 'lz77',
  storage: indexedDB
});

// Create update with version tracking
const update = await manager.create({
  category: 'weather',
  priority: 3,
  data: weatherData,
  subscribers: subscriberList
});
```

#### 2. Subscription Registry
```typescript
import { SubscriptionRegistry } from './lib/subscription-registry';

const registry = new SubscriptionRegistry({
  storage: indexedDB,
  signalingServer: 'ws://localhost:8080'
});

// Manage subscriptions
await registry.subscribe(channel, stationId);
await registry.unsubscribe(subscriptionId);
const subs = await registry.getActiveSubscriptions();
```

#### 3. Retry Coordinator
```typescript
import { RetryCoordinator } from './lib/retry-coordinator';

const coordinator = new RetryCoordinator({
  windowMin: 10, // seconds
  windowMax: 30,
  maxRetries: 3
});

// Handle retry requests
coordinator.on('retryRequest', async (request) => {
  if (await cache.hasUpdate(request.updateId)) {
    await coordinator.scheduleRetry(request);
  }
});
```

#### 4. Cache Manager
```typescript
import { CacheManager } from './lib/cache-manager';

const cache = new CacheManager({
  maxSize: 100 * 1024 * 1024, // 100MB
  evictionPolicy: 'priority-lru'
});

// Cache with automatic expiration
await cache.store(update);
const cached = await cache.get(updateId);

// Eviction happens automatically based on:
// 1. Expiration (P0: 30d, P1: 7d, P2: 24h, P3-5: 1h)
// 2. Priority (lowest first)
// 3. LRU within same priority
```

#### 5. Delivery Router
```typescript
import { DeliveryRouter } from './lib/delivery-router';

const router = new DeliveryRouter({
  preferWebRTC: true,
  beaconMonitor: beaconMonitor
});

// Smart path selection
const path = await router.selectPath(targetStation);
if (path.mode === 'WebRTC') {
  await webrtcTransport.send(update, targetStation);
} else {
  await rfModem.transmit(update);
}
```

### Testing Your Implementation

#### Contract Tests
```bash
# Test update creation API
npm test tests/contract/update-creation.test.ts

# Test subscription management
npm test tests/contract/subscription-management.test.ts

# Test retry protocol
npm test tests/contract/retry-protocol.test.ts
```

#### Integration Tests
```bash
# Test RF to WebRTC fallback
npm test tests/integration/rf-to-webrtc-fallback.test.ts

# Test priority-based delivery
npm test tests/integration/priority-based-delivery.test.ts

# Test cache eviction
npm test tests/integration/cache-eviction.test.ts
```

### Configuration

#### Priority Tiers
```javascript
const priorities = {
  P0: { name: 'Emergency', retention: '30 days', rebroadcast: '5 min' },
  P1: { name: 'Safety', retention: '7 days', rebroadcast: 'on-request' },
  P2: { name: 'Operational', retention: '24 hours', rebroadcast: 'on-request' },
  P3: { name: 'Weather', retention: '1 hour', rebroadcast: 'on-request' },
  P4: { name: 'Traffic', retention: '1 hour', rebroadcast: 'on-request' },
  P5: { name: 'Routine', retention: '1 hour', rebroadcast: 'on-request' }
};
```

#### OFDM Carrier Allocation
```javascript
// Reserved carriers for priority updates
const carrierAllocation = {
  emergency: [40, 41, 42, 43, 44, 45, 46, 47], // P0-P1
  operational: [35, 36, 37, 38, 39], // P2
  routine: [0, 1, 2, ...34] // P3-P5
};
```

## Common Scenarios

### Emergency Alert Distribution
1. Licensed station creates P0 update
2. System broadcasts immediately on carriers 40-47
3. Relay stations cache and echo automatically
4. Rebroadcast every 5 minutes until expiration
5. Unlicensed stations receive via WebRTC from licensed peers

### Weather Update with Poor Propagation
1. Weather station creates P3 update
2. Initial broadcast partially received
3. Stations detect missing update from beacon
4. Licensed stations request retry
5. Coordination window prevents collisions
6. Successful retry via QPSK (more robust)

### Unlicensed Station Participation
1. Unlicensed station subscribes to channels
2. Monitors WebSocket for notifications
3. Requests update from signaling server
4. Signaling server finds licensed holder
5. WebRTC transfer from licensed to unlicensed
6. Unlicensed station caches but doesn't redistribute

## Troubleshooting

### Update Not Received
- Check subscription is active
- Verify you're in subscriber list
- Monitor beacon for update announcements
- Request retry if licensed

### Retry Not Working
- Ensure ECDSA signature is valid
- Check retry window timing (10-30s)
- Verify licensed station status
- Try WebRTC fallback if available

### Cache Full
- Check eviction policy settings
- Manually clear expired updates
- Increase cache size limit
- Prioritize critical subscriptions

### WebRTC Connection Failed
- Check signaling server connection
- Verify STUN/TURN configuration
- Test with different peer
- Fall back to RF mode

## Best Practices

1. **Always prefer WebRTC** when available to reduce RF congestion
2. **Subscribe only to needed channels** to minimize storage
3. **Use appropriate priority levels** - don't mark everything as emergency
4. **Test retry mechanisms** regularly to ensure reliability
5. **Monitor cache usage** and adjust limits as needed
6. **Validate signatures** to prevent unauthorized updates
7. **Respect FCC regulations** - only licensed stations transmit

## CLI Commands

Each library includes a CLI for testing:

```bash
# Update Manager CLI
./lib/update-manager/cli --create --priority 0 --data "Emergency message"
./lib/update-manager/cli --list --since "2024-01-15"

# Subscription Registry CLI
./lib/subscription-registry/cli --subscribe emergency.alerts --station KA1ABC
./lib/subscription-registry/cli --list --active

# Retry Coordinator CLI
./lib/retry-coordinator/cli --request EMRG-2024-001 --version 2
./lib/retry-coordinator/cli --status --pending

# Cache Manager CLI
./lib/cache-manager/cli --stats
./lib/cache-manager/cli --evict --priority 5

# Delivery Router CLI
./lib/delivery-router/cli --route KB2DEF
./lib/delivery-router/cli --beacon-status
```

## Next Steps

1. Review the [full specification](spec.md)
2. Examine the [data model](data-model.md)
3. Study the [API contracts](contracts/)
4. Run the test suite
5. Deploy to test environment
6. Field test with real radios