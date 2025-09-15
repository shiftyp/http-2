// T005 - Contract test GET /api/mesh/topology
import { describe, it, expect } from 'vitest';

describe('GET /api/mesh/topology Contract', () => {
  it('should return current network topology with correct schema', async () => {
    // This test MUST fail initially (RED phase of TDD)
    const response = await fetch('/api/mesh/topology');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const topology = await response.json();

    // Validate NetworkTopology schema
    expect(topology).toHaveProperty('networkId');
    expect(topology).toHaveProperty('stations');
    expect(topology).toHaveProperty('links');
    expect(topology).toHaveProperty('routes');
    expect(topology).toHaveProperty('lastUpdate');
    expect(topology).toHaveProperty('partitionCount');

    expect(typeof topology.networkId).toBe('string');
    expect(typeof topology.stations).toBe('object');
    expect(Array.isArray(topology.links)).toBe(true);
    expect(Array.isArray(topology.routes)).toBe(true);
    expect(typeof topology.lastUpdate).toBe('number');
    expect(typeof topology.partitionCount).toBe('number');
    expect(topology.partitionCount).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty topology gracefully', async () => {
    const response = await fetch('/api/mesh/topology');
    const topology = await response.json();

    // Even empty topology should have valid structure
    expect(topology.stations).toBeDefined();
    expect(topology.links).toBeDefined();
    expect(topology.routes).toBeDefined();
  });
});