// Registration system for HTTP-over-Radio (similar to Winlink)
// Manages station registration, discovery, and directory services

export interface StationInfo {
  callsign: string;
  gridSquare: string;
  realName?: string;
  email?: string;
  publicKey: string;
  capabilities: string[];
  services: ServiceInfo[];
  lastSeen: number;
  registered: number;
  status: 'active' | 'inactive' | 'away';
}

export interface ServiceInfo {
  name: string;
  path: string;
  description: string;
  version: string;
}

export interface RegistrationBeacon {
  type: 'BEACON';
  station: StationInfo;
  signature: string;
}

export interface RegistrationRequest {
  type: 'REGISTER';
  station: StationInfo;
  signature: string;
}

export interface RegistrationResponse {
  type: 'ACK' | 'NAK';
  callsign: string;
  message?: string;
  directory?: StationInfo[];
}

export class RegistrationManager {
  private localStation: StationInfo | null = null;
  private directory: Map<string, StationInfo> = new Map();
  private beaconInterval: number | null = null;
  private registrationServers: string[] = [
    'W1AW',    // ARRL HQ
    'K0USA',   // Central US
    'VE7CC',   // Canada
    'G0KTN',   // UK
    'VK2GOM',  // Australia
    'JA1ZLO'   // Japan
  ];

  async initialize(callsign: string, gridSquare: string): Promise<void> {
    // Load or create station info
    const stored = localStorage.getItem(`station_${callsign}`);
    
    if (stored) {
      this.localStation = JSON.parse(stored);
      // Update last seen
      this.localStation.lastSeen = Date.now();
    } else {
      // Create new station registration
      const { cryptoManager } = await import('../crypto');
      
      // Generate or load key pair
      let keyPair = await cryptoManager.loadKeyPair(callsign);
      if (!keyPair) {
        keyPair = await cryptoManager.generateKeyPair(callsign);
      }

      this.localStation = {
        callsign,
        gridSquare,
        publicKey: keyPair.publicKeyPem,
        capabilities: [
          'HTTP/1.1',
          'COMPRESSION/JSX',
          'MESH/AODV',
          'CRYPTO/ECDSA',
          'MODES/QPSK,16QAM'
        ],
        services: [],
        lastSeen: Date.now(),
        registered: Date.now(),
        status: 'active'
      };

      this.saveLocalStation();
    }

    // Load directory from cache
    this.loadDirectory();

    // Start beacon broadcasts
    this.startBeacon();
  }

  private saveLocalStation(): void {
    if (!this.localStation) return;
    localStorage.setItem(
      `station_${this.localStation.callsign}`,
      JSON.stringify(this.localStation)
    );
  }

  private loadDirectory(): void {
    const stored = localStorage.getItem('station_directory');
    if (stored) {
      const directory = JSON.parse(stored);
      for (const station of directory) {
        this.directory.set(station.callsign, station);
      }
    }
  }

  private saveDirectory(): void {
    const directory = Array.from(this.directory.values());
    localStorage.setItem('station_directory', JSON.stringify(directory));
  }

  async registerService(service: ServiceInfo): Promise<void> {
    if (!this.localStation) {
      throw new Error('Station not initialized');
    }

    // Add or update service
    const existingIndex = this.localStation.services.findIndex(
      s => s.name === service.name
    );

    if (existingIndex >= 0) {
      this.localStation.services[existingIndex] = service;
    } else {
      this.localStation.services.push(service);
    }

    this.saveLocalStation();

    // Broadcast updated registration
    await this.broadcastRegistration();
  }

  async unregisterService(serviceName: string): Promise<void> {
    if (!this.localStation) {
      throw new Error('Station not initialized');
    }

    this.localStation.services = this.localStation.services.filter(
      s => s.name !== serviceName
    );

    this.saveLocalStation();
    await this.broadcastRegistration();
  }

  private startBeacon(): void {
    // Broadcast beacon every 10 minutes
    this.beaconInterval = window.setInterval(() => {
      this.broadcastBeacon();
    }, 10 * 60 * 1000);

    // Initial beacon
    this.broadcastBeacon();
  }

  private stopBeacon(): void {
    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
      this.beaconInterval = null;
    }
  }

  private async broadcastBeacon(): Promise<void> {
    if (!this.localStation) return;

    const { cryptoManager } = await import('../crypto');

    // Create beacon message
    const beacon: RegistrationBeacon = {
      type: 'BEACON',
      station: {
        ...this.localStation,
        lastSeen: Date.now()
      },
      signature: ''
    };

    // Sign beacon
    const signed = await cryptoManager.signRequest(
      'BEACON',
      '/registration',
      {},
      beacon.station
    );

    beacon.signature = signed.signature;

    // Dispatch beacon event for transmission
    window.dispatchEvent(new CustomEvent('registration-beacon', {
      detail: beacon
    }));

    console.log(`[Registration] Beacon broadcast for ${this.localStation.callsign}`);
  }

  private async broadcastRegistration(): Promise<void> {
    if (!this.localStation) return;

    const { cryptoManager } = await import('../crypto');

    // Create registration request
    const request: RegistrationRequest = {
      type: 'REGISTER',
      station: this.localStation,
      signature: ''
    };

    // Sign request
    const signed = await cryptoManager.signRequest(
      'REGISTER',
      '/registration',
      {},
      request.station
    );

    request.signature = signed.signature;

    // Send to registration servers
    for (const server of this.registrationServers) {
      window.dispatchEvent(new CustomEvent('registration-request', {
        detail: {
          destination: server,
          request
        }
      }));
    }

    console.log(`[Registration] Sent registration to ${this.registrationServers.length} servers`);
  }

  async handleBeacon(beacon: RegistrationBeacon): Promise<void> {
    const { cryptoManager } = await import('../crypto');

    // Verify signature
    const valid = await cryptoManager.verifyRequest({
      request: {
        method: 'BEACON',
        path: '/registration',
        headers: {},
        body: beacon.station,
        timestamp: beacon.station.lastSeen,
        nonce: ''
      },
      signature: beacon.signature,
      publicKey: beacon.station.publicKey,
      callsign: beacon.station.callsign
    });

    if (!valid) {
      console.error(`[Registration] Invalid beacon signature from ${beacon.station.callsign}`);
      return;
    }

    // Update directory
    this.directory.set(beacon.station.callsign, beacon.station);
    this.saveDirectory();

    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('station-discovered', {
      detail: beacon.station
    }));

    console.log(`[Registration] Received beacon from ${beacon.station.callsign}`);
  }

  async handleRegistrationRequest(request: RegistrationRequest): Promise<void> {
    const { cryptoManager } = await import('../crypto');

    // Verify signature
    const valid = await cryptoManager.verifyRequest({
      request: {
        method: 'REGISTER',
        path: '/registration',
        headers: {},
        body: request.station,
        timestamp: request.station.lastSeen,
        nonce: ''
      },
      signature: request.signature,
      publicKey: request.station.publicKey,
      callsign: request.station.callsign
    });

    if (!valid) {
      console.error(`[Registration] Invalid registration signature from ${request.station.callsign}`);
      
      // Send NAK
      const response: RegistrationResponse = {
        type: 'NAK',
        callsign: request.station.callsign,
        message: 'Invalid signature'
      };

      window.dispatchEvent(new CustomEvent('registration-response', {
        detail: {
          destination: request.station.callsign,
          response
        }
      }));
      return;
    }

    // Add to directory
    this.directory.set(request.station.callsign, request.station);
    this.saveDirectory();

    // Send ACK with directory
    const response: RegistrationResponse = {
      type: 'ACK',
      callsign: request.station.callsign,
      directory: Array.from(this.directory.values())
    };

    window.dispatchEvent(new CustomEvent('registration-response', {
      detail: {
        destination: request.station.callsign,
        response
      }
    }));

    console.log(`[Registration] Registered station ${request.station.callsign}`);
  }

  async handleRegistrationResponse(response: RegistrationResponse): Promise<void> {
    if (response.type === 'ACK') {
      console.log(`[Registration] Registration acknowledged by ${response.callsign}`);
      
      // Update directory if provided
      if (response.directory) {
        for (const station of response.directory) {
          this.directory.set(station.callsign, station);
        }
        this.saveDirectory();
        console.log(`[Registration] Updated directory with ${response.directory.length} stations`);
      }
    } else {
      console.error(`[Registration] Registration rejected by ${response.callsign}: ${response.message}`);
    }
  }

  // Query functions
  getStation(callsign: string): StationInfo | undefined {
    return this.directory.get(callsign);
  }

  getStationsByGrid(gridSquare: string): StationInfo[] {
    return Array.from(this.directory.values()).filter(
      s => s.gridSquare.startsWith(gridSquare.substring(0, 4))
    );
  }

  getStationsWithService(serviceName: string): StationInfo[] {
    return Array.from(this.directory.values()).filter(
      s => s.services.some(srv => srv.name === serviceName)
    );
  }

  getActiveStations(maxAge: number = 3600000): StationInfo[] {
    const cutoff = Date.now() - maxAge;
    return Array.from(this.directory.values()).filter(
      s => s.lastSeen > cutoff && s.status === 'active'
    );
  }

  getAllStations(): StationInfo[] {
    return Array.from(this.directory.values());
  }

  // Status management
  setStatus(status: 'active' | 'inactive' | 'away'): void {
    if (!this.localStation) return;
    
    this.localStation.status = status;
    this.localStation.lastSeen = Date.now();
    this.saveLocalStation();
    
    if (status === 'active') {
      this.startBeacon();
    } else {
      this.stopBeacon();
    }
    
    // Broadcast status change
    this.broadcastBeacon();
  }

  // Cleanup
  dispose(): void {
    this.stopBeacon();
    this.directory.clear();
  }
}

// Global registration manager instance
export const registrationManager = new RegistrationManager();