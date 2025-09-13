/**
 * Tests for Mesh Networking Library
 * Tests AODV routing, packet forwarding, and mesh network management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AODVRouter, MeshNetwork, MeshNode, RoutingTableEntry, RouteRequest, RouteReply, RouteError, MeshPacket } from './index';

describe('AODVRouter', () => {
  let router: AODVRouter;
  const testCallsign = 'KA1ABC';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    router = new AODVRouter(testCallsign);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with callsign', () => {
      expect(router).toBeDefined();
      expect(router.getRoutingTable()).toEqual([]);
    });

    it('should generate consistent mesh address from callsign', () => {
      const router1 = new AODVRouter('KA1ABC');
      const router2 = new AODVRouter('KA1ABC');

      // Same callsign should generate same address
      expect((router1 as any).myAddress).toBe((router2 as any).myAddress);
    });

    it('should generate different addresses for different callsigns', () => {
      const router1 = new AODVRouter('KA1ABC');
      const router2 = new AODVRouter('KB2XYZ');

      expect((router1 as any).myAddress).not.toBe((router2 as any).myAddress);
    });

    it('should generate IPv6-like mesh addresses', () => {
      const address = (router as any).myAddress;
      expect(address).toMatch(/^fe80::[0-9a-f:]+$/);
    });

    it('should set up periodic route maintenance', () => {
      const maintainRoutesSpy = vi.spyOn(router as any, 'maintainRoutes');

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      expect(maintainRoutesSpy).toHaveBeenCalled();
    });
  });

  describe('Route Discovery', () => {
    it('should return existing valid route if available', async () => {
      const destination = 'fe80::1234:5678:9abc:def0';
      const existingRoute: RoutingTableEntry = {
        destination,
        nextHop: 'fe80::aaaa:bbbb:cccc:dddd',
        metric: 200,
        sequenceNumber: 5,
        lastUpdated: Date.now(),
        linkQuality: 90,
        hopCount: 2
      };

      // Add route to table
      (router as any).routingTable.set(destination, existingRoute);

      const route = await router.discoverRoute(destination);
      expect(route).toEqual(existingRoute);
    });

    it('should initiate route discovery for unknown destination', async () => {
      const broadcastSpy = vi.spyOn(router as any, 'broadcastRouteRequest')
        .mockImplementation(() => Promise.resolve());

      const destination = 'fe80::9999:8888:7777:6666';

      // Start discovery (won't complete due to timeout)
      const discoveryPromise = router.discoverRoute(destination);

      // Should broadcast RREQ
      expect(broadcastSpy).toHaveBeenCalled();
      const rreq = broadcastSpy.mock.calls[0][0] as RouteRequest;
      expect(rreq.type).toBe('RREQ');
      expect(rreq.destination).toBe(destination);
      expect(rreq.hopCount).toBe(0);

      // Fast-forward to timeout and wait for all timers
      await vi.advanceTimersByTimeAsync(10000);

      const result = await discoveryPromise;
      expect(result).toBeNull();
    });

    it('should cache message to prevent loops', async () => {
      const broadcastSpy = vi.spyOn(router as any, 'broadcastRouteRequest')
        .mockImplementation(() => Promise.resolve());

      const destination = 'fe80::1111:2222:3333:4444';

      router.discoverRoute(destination);

      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      const rreq = broadcastSpy.mock.calls[0][0] as RouteRequest;

      // Message should be cached
      expect((router as any).messageCache.has(rreq.messageId)).toBe(true);
    });

    it('should resolve when route is found during discovery', async () => {
      const destination = 'fe80::5555:6666:7777:8888';

      vi.spyOn(router as any, 'broadcastRouteRequest')
        .mockImplementation(() => Promise.resolve());

      const discoveryPromise = router.discoverRoute(destination);

      // Simulate route being added after a short delay
      setTimeout(() => {
        (router as any).routingTable.set(destination, {
          destination,
          nextHop: 'fe80::next:hop:addr:ess',
          metric: 100,
          sequenceNumber: 1,
          lastUpdated: Date.now(),
          linkQuality: 95,
          hopCount: 1
        });
      }, 500);

      await vi.advanceTimersByTimeAsync(600);

      const route = await discoveryPromise;
      expect(route).toBeDefined();
      expect(route?.destination).toBe(destination);
    });
  });

  describe('Route Request Handling', () => {
    const mockSender = 'fe80::sender:addr:ess:0001';

    it('should ignore duplicate route requests', () => {
      const rreq: RouteRequest = {
        type: 'RREQ',
        source: 'fe80::source:addr:ess:0001',
        destination: 'fe80::dest:addr:ess:0001',
        sequenceNumber: 1,
        hopCount: 2,
        messageId: 'test-msg-001',
        timestamp: Date.now()
      };

      // Add to cache
      (router as any).messageCache.set(rreq.messageId, Date.now());

      const updateRouteSpy = vi.spyOn(router as any, 'updateRoute');

      router.handleRouteRequest(rreq, mockSender);

      expect(updateRouteSpy).not.toHaveBeenCalled();
    });

    it('should update reverse route to source', () => {
      const rreq: RouteRequest = {
        type: 'RREQ',
        source: 'fe80::source:addr:ess:0002',
        destination: 'fe80::dest:addr:ess:0002',
        sequenceNumber: 1,
        hopCount: 2,
        messageId: 'test-msg-002',
        timestamp: Date.now()
      };

      const updateRouteSpy = vi.spyOn(router as any, 'updateRoute');

      router.handleRouteRequest(rreq, mockSender);

      expect(updateRouteSpy).toHaveBeenCalledWith(
        rreq.source,
        mockSender,
        rreq.hopCount + 1,
        rreq.sequenceNumber
      );
    });

    it('should send RREP when it is the destination', () => {
      const myAddress = (router as any).myAddress;
      const rreq: RouteRequest = {
        type: 'RREQ',
        source: 'fe80::source:addr:ess:0003',
        destination: myAddress,
        sequenceNumber: 1,
        hopCount: 2,
        messageId: 'test-msg-003',
        timestamp: Date.now()
      };

      const sendReplySpy = vi.spyOn(router as any, 'sendRouteReply')
        .mockImplementation(() => {});

      router.handleRouteRequest(rreq, mockSender);

      expect(sendReplySpy).toHaveBeenCalled();
      const rrep = sendReplySpy.mock.calls[0][0] as RouteReply;
      expect(rrep.type).toBe('RREP');
      expect(rrep.source).toBe(myAddress);
      expect(rrep.destination).toBe(rreq.source);
    });

    it('should forward RREQ if not destination and no route', () => {
      const rreq: RouteRequest = {
        type: 'RREQ',
        source: 'fe80::source:addr:ess:0004',
        destination: 'fe80::dest:addr:ess:0004',
        sequenceNumber: 1,
        hopCount: 2,
        messageId: 'test-msg-004',
        timestamp: Date.now()
      };

      const broadcastSpy = vi.spyOn(router as any, 'broadcastRouteRequest')
        .mockImplementation(() => {});

      router.handleRouteRequest(rreq, mockSender);

      expect(broadcastSpy).toHaveBeenCalled();
      const forwardedRreq = broadcastSpy.mock.calls[0][0] as RouteRequest;
      expect(forwardedRreq.hopCount).toBe(rreq.hopCount + 1);
    });

    it('should not forward RREQ if hop count exceeds limit', () => {
      const rreq: RouteRequest = {
        type: 'RREQ',
        source: 'fe80::source:addr:ess:0005',
        destination: 'fe80::dest:addr:ess:0005',
        sequenceNumber: 1,
        hopCount: 9, // Will become 10 after increment
        messageId: 'test-msg-005',
        timestamp: Date.now()
      };

      const broadcastSpy = vi.spyOn(router as any, 'broadcastRouteRequest')
        .mockImplementation(() => {});

      router.handleRouteRequest(rreq, mockSender);

      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it('should send RREP on behalf if route exists', () => {
      const destination = 'fe80::dest:addr:ess:0006';
      const rreq: RouteRequest = {
        type: 'RREQ',
        source: 'fe80::source:addr:ess:0006',
        destination,
        sequenceNumber: 1,
        hopCount: 2,
        messageId: 'test-msg-006',
        timestamp: Date.now()
      };

      // Add route to destination
      (router as any).routingTable.set(destination, {
        destination,
        nextHop: 'fe80::next:hop:0001',
        metric: 100,
        sequenceNumber: 5,
        lastUpdated: Date.now(),
        linkQuality: 85,
        hopCount: 1
      });

      const sendReplySpy = vi.spyOn(router as any, 'sendRouteReply')
        .mockImplementation(() => {});

      router.handleRouteRequest(rreq, mockSender);

      expect(sendReplySpy).toHaveBeenCalled();
      const rrep = sendReplySpy.mock.calls[0][0] as RouteReply;
      expect(rrep.source).toBe(destination);
      expect(rrep.hopCount).toBe(1);
    });
  });

  describe('Route Reply Handling', () => {
    it('should update route to destination', () => {
      const rrep: RouteReply = {
        type: 'RREP',
        source: 'fe80::rrep:source:0001',
        destination: 'fe80::rrep:dest:0001',
        sequenceNumber: 3,
        hopCount: 2,
        lifetime: 300000,
        messageId: 'rrep-001'
      };

      const updateRouteSpy = vi.spyOn(router as any, 'updateRoute');

      router.handleRouteReply(rrep, 'fe80::sender:0001');

      expect(updateRouteSpy).toHaveBeenCalledWith(
        rrep.source,
        'fe80::sender:0001',
        rrep.hopCount + 1,
        rrep.sequenceNumber
      );
    });

    it('should forward RREP if not final destination', () => {
      const rrep: RouteReply = {
        type: 'RREP',
        source: 'fe80::rrep:source:0002',
        destination: 'fe80::rrep:dest:0002',
        sequenceNumber: 3,
        hopCount: 2,
        lifetime: 300000,
        messageId: 'rrep-002'
      };

      // Add route to RREP destination
      (router as any).routingTable.set(rrep.destination, {
        destination: rrep.destination,
        nextHop: 'fe80::forward:to:0001',
        metric: 100,
        sequenceNumber: 1,
        lastUpdated: Date.now(),
        linkQuality: 90,
        hopCount: 1
      });

      const forwardSpy = vi.spyOn(router as any, 'forwardRouteReply')
        .mockImplementation(() => {});

      router.handleRouteReply(rrep, 'fe80::sender:0002');

      expect(forwardSpy).toHaveBeenCalledWith(rrep, 'fe80::forward:to:0001');
    });
  });

  describe('Route Error Handling', () => {
    it('should remove unreachable routes', () => {
      const unreachable = ['fe80::dead:beef:0001', 'fe80::dead:beef:0002'];

      // Add routes
      unreachable.forEach(dest => {
        (router as any).routingTable.set(dest, {
          destination: dest,
          nextHop: 'fe80::next:0001',
          metric: 100,
          sequenceNumber: 1,
          lastUpdated: Date.now(),
          linkQuality: 80,
          hopCount: 2
        });
      });

      const rerr: RouteError = {
        type: 'RERR',
        unreachableDestinations: unreachable,
        source: 'fe80::error:source:0001'
      };

      router.handleRouteError(rerr);

      unreachable.forEach(dest => {
        expect((router as any).routingTable.has(dest)).toBe(false);
      });
    });

    it('should propagate RERR for affected routes', () => {
      const nextHop = 'fe80::bad:next:hop';

      // Add route that uses the bad next hop
      (router as any).routingTable.set('fe80::dest:via:bad', {
        destination: 'fe80::dest:via:bad',
        nextHop,
        metric: 200,
        sequenceNumber: 1,
        lastUpdated: Date.now(),
        linkQuality: 70,
        hopCount: 3
      });

      const broadcastSpy = vi.spyOn(router as any, 'broadcastRouteError')
        .mockImplementation(() => {});

      const rerr: RouteError = {
        type: 'RERR',
        unreachableDestinations: [nextHop],
        source: 'fe80::error:source:0002'
      };

      router.handleRouteError(rerr);

      expect(broadcastSpy).toHaveBeenCalled();
    });
  });

  describe('Route Management', () => {
    it('should update route with better metric', () => {
      const destination = 'fe80::update:test:0001';

      // Add initial route
      (router as any).updateRoute(destination, 'fe80::hop1', 3, 1);

      let route = (router as any).routingTable.get(destination);
      expect(route.hopCount).toBe(3);

      // Update with better route (fewer hops)
      (router as any).updateRoute(destination, 'fe80::hop2', 2, 1);

      route = (router as any).routingTable.get(destination);
      expect(route.hopCount).toBe(2);
      expect(route.nextHop).toBe('fe80::hop2');
    });

    it('should update route with newer sequence number', () => {
      const destination = 'fe80::update:test:0002';

      // Add initial route
      (router as any).updateRoute(destination, 'fe80::hop1', 2, 5);

      // Update with newer sequence (even if more hops)
      (router as any).updateRoute(destination, 'fe80::hop2', 3, 6);

      const route = (router as any).routingTable.get(destination);
      expect(route.sequenceNumber).toBe(6);
      expect(route.nextHop).toBe('fe80::hop2');
    });

    it('should not update with older sequence number', () => {
      const destination = 'fe80::update:test:0003';

      // Add initial route
      (router as any).updateRoute(destination, 'fe80::hop1', 2, 5);

      // Try to update with older sequence
      (router as any).updateRoute(destination, 'fe80::hop2', 1, 4);

      const route = (router as any).routingTable.get(destination);
      expect(route.sequenceNumber).toBe(5);
      expect(route.nextHop).toBe('fe80::hop1');
    });
  });

  describe('Route Maintenance', () => {
    it('should remove stale routes', () => {
      const destination = 'fe80::stale:route:0001';

      // Add route with old timestamp
      (router as any).routingTable.set(destination, {
        destination,
        nextHop: 'fe80::next:0001',
        metric: 100,
        sequenceNumber: 1,
        lastUpdated: Date.now() - 400000, // 6+ minutes old
        linkQuality: 50,
        hopCount: 2
      });

      (router as any).maintainRoutes();

      expect((router as any).routingTable.has(destination)).toBe(false);
    });

    it('should broadcast RERR for removed stale routes', () => {
      const destination = 'fe80::stale:route:0002';

      // Add stale route
      (router as any).routingTable.set(destination, {
        destination,
        nextHop: 'fe80::next:0002',
        metric: 100,
        sequenceNumber: 1,
        lastUpdated: Date.now() - 400000,
        linkQuality: 40,
        hopCount: 3
      });

      const broadcastSpy = vi.spyOn(router as any, 'broadcastRouteError')
        .mockImplementation(() => {});

      (router as any).maintainRoutes();

      expect(broadcastSpy).toHaveBeenCalled();
      const rerr = broadcastSpy.mock.calls[0][0] as RouteError;
      expect(rerr.unreachableDestinations).toContain(destination);
    });

    it('should clean up old message cache entries', () => {
      const oldMessageId = 'old-msg-001';
      const recentMessageId = 'recent-msg-001';

      // Add old and recent messages
      (router as any).messageCache.set(oldMessageId, Date.now() - 70000); // 70 seconds old
      (router as any).messageCache.set(recentMessageId, Date.now() - 30000); // 30 seconds old

      (router as any).maintainRoutes();

      expect((router as any).messageCache.has(oldMessageId)).toBe(false);
      expect((router as any).messageCache.has(recentMessageId)).toBe(true);
    });
  });

  describe('Route Metrics', () => {
    it('should return route metrics for existing route', () => {
      const destination = 'fe80::metrics:test:0001';
      const route: RoutingTableEntry = {
        destination,
        nextHop: 'fe80::next:hop:metrics',
        metric: 150,
        sequenceNumber: 3,
        lastUpdated: Date.now() - 10000,
        linkQuality: 88,
        hopCount: 2
      };

      (router as any).routingTable.set(destination, route);

      const metrics = router.getRouteMetrics(destination);

      expect(metrics).toBeDefined();
      expect(metrics.destination).toBe(destination);
      expect(metrics.hopCount).toBe(2);
      expect(metrics.linkQuality).toBe(88);
      expect(metrics.age).toBeGreaterThanOrEqual(10000);
    });

    it('should return null for non-existent route', () => {
      const metrics = router.getRouteMetrics('fe80::does:not:exist');
      expect(metrics).toBeNull();
    });
  });

  describe('Routing Table', () => {
    it('should return all routes', () => {
      const routes = [
        {
          destination: 'fe80::route:0001',
          nextHop: 'fe80::hop:0001',
          metric: 100,
          sequenceNumber: 1,
          lastUpdated: Date.now(),
          linkQuality: 90,
          hopCount: 1
        },
        {
          destination: 'fe80::route:0002',
          nextHop: 'fe80::hop:0002',
          metric: 200,
          sequenceNumber: 2,
          lastUpdated: Date.now(),
          linkQuality: 80,
          hopCount: 2
        }
      ];

      routes.forEach(route => {
        (router as any).routingTable.set(route.destination, route);
      });

      const table = router.getRoutingTable();

      expect(table).toHaveLength(2);
      expect(table).toEqual(expect.arrayContaining(routes));
    });

    it('should return empty array when no routes', () => {
      const table = router.getRoutingTable();
      expect(table).toEqual([]);
    });
  });

  describe('Message ID Generation', () => {
    it('should generate unique message IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const id = (router as any).generateMessageId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });

    it('should include callsign in message ID', () => {
      const id = (router as any).generateMessageId();
      expect(id).toContain(testCallsign);
    });
  });

  describe('Route Validity', () => {
    it('should consider fresh routes valid', () => {
      const route: RoutingTableEntry = {
        destination: 'fe80::valid:0001',
        nextHop: 'fe80::next:0001',
        metric: 100,
        sequenceNumber: 1,
        lastUpdated: Date.now(),
        linkQuality: 95,
        hopCount: 1
      };

      expect((router as any).isRouteValid(route)).toBe(true);
    });

    it('should consider old routes invalid', () => {
      const route: RoutingTableEntry = {
        destination: 'fe80::invalid:0001',
        nextHop: 'fe80::next:0001',
        metric: 100,
        sequenceNumber: 1,
        lastUpdated: Date.now() - 301000, // 5+ minutes old
        linkQuality: 95,
        hopCount: 1
      };

      expect((router as any).isRouteValid(route)).toBe(false);
    });
  });

  describe('Hash Function', () => {
    it('should generate consistent hash for same input', () => {
      const hash1 = (router as any).hashCallsign('TEST123');
      const hash2 = (router as any).hashCallsign('TEST123');

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = (router as any).hashCallsign('ABC123');
      const hash2 = (router as any).hashCallsign('XYZ789');

      expect(hash1).not.toBe(hash2);
    });

    it('should generate positive hash values', () => {
      const testCallsigns = ['KA1ABC', 'KB2XYZ', 'W1AW', 'N0CALL'];

      testCallsigns.forEach(callsign => {
        const hash = (router as any).hashCallsign(callsign);
        expect(hash).toBeGreaterThanOrEqual(0);
      });
    });
  });
});