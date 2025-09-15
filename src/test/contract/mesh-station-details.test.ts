// T007 - Contract test GET /api/mesh/stations/{callsign}
import { describe, it, expect } from 'vitest';

describe('GET /api/mesh/stations/{callsign} Contract', () => {
  it('should return specific station details', async () => {
    const testCallsign = 'N0TEST';
    const response = await fetch(`/api/mesh/stations/${testCallsign}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const station = await response.json();

    // Validate complete StationNode schema
    expect(station.callsign).toBe(testCallsign);
    expect(station).toHaveProperty('lastSeen');
    expect(station).toHaveProperty('status');
    expect(station).toHaveProperty('meshAddress');

    // Equipment info should be present for detailed view
    if (station.equipmentInfo) {
      expect(station.equipmentInfo).toHaveProperty('frequency');
      expect(station.equipmentInfo).toHaveProperty('mode');
      expect(station.equipmentInfo).toHaveProperty('power');
      expect(station.equipmentInfo).toHaveProperty('protocolVersion');

      expect(typeof station.equipmentInfo.frequency).toBe('number');
      expect(station.equipmentInfo.frequency).toBeGreaterThanOrEqual(1800000); // 1.8 MHz
      expect(station.equipmentInfo.frequency).toBeLessThanOrEqual(30000000); // 30 MHz
      expect(typeof station.equipmentInfo.power).toBe('number');
      expect(station.equipmentInfo.power).toBeGreaterThanOrEqual(1);
      expect(station.equipmentInfo.power).toBeLessThanOrEqual(1500);
    }
  });

  it('should return 404 for non-existent station', async () => {
    const response = await fetch('/api/mesh/stations/NONEXISTENT');
    expect(response.status).toBe(404);
  });

  it('should validate callsign format', async () => {
    // Invalid callsign should return 400
    const response = await fetch('/api/mesh/stations/invalid-callsign');
    expect(response.status).toBe(400);
  });
});