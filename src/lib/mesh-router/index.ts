/**
 * Mesh Router - Mock implementation for testing
 */

export interface MeshRouterConfig {
  db: IDBDatabase;
  callsign: string;
}

export class MeshRouter {
  private db: IDBDatabase;
  private callsign: string;

  constructor(config: MeshRouterConfig) {
    this.db = config.db;
    this.callsign = config.callsign;
  }

  async findRoute(destination: string): Promise<string[] | null> {
    // Mock implementation
    return [this.callsign, destination];
  }

  async getRoutingTable(): Promise<Map<string, string[]>> {
    return new Map();
  }
}