// T006 - Contract test GET /api/mesh/stations
import { describe, it, expect } from 'vitest';

describe('GET /api/mesh/stations Contract', () => {
  it('should return array of station nodes', async () => {
    const response = await fetch('/api/mesh/stations');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const stations = await response.json();
    expect(Array.isArray(stations)).toBe(true);

    // Validate StationNode schema for each station
    stations.forEach((station: any) => {
      expect(station).toHaveProperty('callsign');
      expect(station).toHaveProperty('lastSeen');
      expect(station).toHaveProperty('status');
      expect(station).toHaveProperty('meshAddress');

      expect(typeof station.callsign).toBe('string');
      expect(station.callsign).toMatch(/^[A-Z0-9]{3,6}$/); // Amateur radio callsign format
      expect(typeof station.lastSeen).toBe('number');
      expect(['active', 'inactive', 'unreachable']).toContain(station.status);
      expect(typeof station.meshAddress).toBe('string');

      // GPS coordinates are optional
      if (station.coordinates) {
        expect(station.coordinates).toHaveProperty('latitude');
        expect(station.coordinates).toHaveProperty('longitude');
        expect(station.coordinates.latitude).toBeGreaterThanOrEqual(-90);
        expect(station.coordinates.latitude).toBeLessThanOrEqual(90);
        expect(station.coordinates.longitude).toBeGreaterThanOrEqual(-180);
        expect(station.coordinates.longitude).toBeLessThanOrEqual(180);
      }
    });
  });

  it('should filter stations by status parameter', async () => {
    const response = await fetch('/api/mesh/stations?status=active');
    expect(response.status).toBe(200);

    const stations = await response.json();
    stations.forEach((station: any) => {
      expect(station.status).toBe('active');
    });
  });

  it('should include signal metrics when requested', async () => {
    const response = await fetch('/api/mesh/stations?includeMetrics=true');
    expect(response.status).toBe(200);

    const stations = await response.json();
    stations.forEach((station: any) => {
      if (station.equipmentInfo?.signalQuality) {
        const metrics = station.equipmentInfo.signalQuality;
        expect(metrics).toHaveProperty('snr');
        expect(metrics).toHaveProperty('signalStrength');
        expect(metrics).toHaveProperty('linkQuality');

        expect(typeof metrics.snr).toBe('number');
        expect(typeof metrics.signalStrength).toBe('number');
        expect(typeof metrics.linkQuality).toBe('number');
        expect(metrics.linkQuality).toBeGreaterThanOrEqual(0);
        expect(metrics.linkQuality).toBeLessThanOrEqual(100);
      }
    });
  });
});