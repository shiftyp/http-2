import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';

describe('Emergency Deployment Scenario', () => {
  let serverProcess: ChildProcess;
  const serverPort = 8093;
  const emergencyConfigPath = path.join(process.cwd(), 'emergency-config.json');

  beforeAll(async () => {
    // Create emergency configuration
    const emergencyConfig = {
      server: { port: serverPort },
      emergency: { enabled: true },
      logging: { level: 'warn', console: true },
      certificates: { requireBootstrap: true }
    };
    
    fs.writeFileSync(emergencyConfigPath, JSON.stringify(emergencyConfig));
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Clean up
    if (fs.existsSync(emergencyConfigPath)) {
      fs.unlinkSync(emergencyConfigPath);
    }
  });

  it('should start in emergency mode with minimal configuration', async () => {
    // Start server with emergency flag
    serverProcess = spawn('node', [
      path.join(process.cwd(), 'signaling-server', 'server.js'),
      '--emergency',
      '--config', emergencyConfigPath,
      '--port', serverPort.toString(),
      '--no-bootstrap'
    ], {
      cwd: process.cwd()
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if port is open
    const isPortOpen = await new Promise<boolean>((resolve) => {
      const client = new net.Socket();
      client.setTimeout(1000);
      
      client.on('connect', () => {
        client.destroy();
        resolve(true);
      });
      
      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });
      
      client.on('error', () => {
        resolve(false);
      });
      
      client.connect(serverPort, 'localhost');
    });
    
    expect(isPortOpen).toBe(true);
  });

  it('should serve PWA in emergency mode', async () => {
    // Make HTTP request to check PWA serving
    const response = await fetch(`http://localhost:${serverPort}/`);
    expect(response.ok).toBe(true);
    
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('text/html');
  });

  it('should function without internet connectivity', async () => {
    // Server should work even without external network
    // Test local-only endpoints
    const healthResponse = await fetch(`http://localhost:${serverPort}/health`);
    expect(healthResponse.ok).toBe(true);
    
    const health = await healthResponse.json();
    expect(health).toHaveProperty('status', 'ok');
    expect(health).toHaveProperty('emergencyMode', true);
  });

  it('should accept certificate bootstrap in emergency mode', async () => {
    const bootstrapResponse = await fetch(
      `http://localhost:${serverPort}/api/certificates/bootstrap`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificatePem: `-----BEGIN CERTIFICATE-----
EMERGENCY_CERT_DATA
-----END CERTIFICATE-----`,
          callsign: 'EMRG1',
          description: 'Emergency operations certificate',
          emergencyUse: true
        })
      }
    );
    
    expect(bootstrapResponse.ok).toBe(true);
    const result = await bootstrapResponse.json();
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('emergencyMode', true);
  });

  it('should log minimal information in emergency mode', async () => {
    // Check that logging is reduced
    const logOutput = serverProcess.stderr?.read();
    
    // Should only contain warnings and errors, no info/debug
    if (logOutput) {
      const logs = logOutput.toString();
      expect(logs).not.toContain('[INFO]');
      expect(logs).not.toContain('[DEBUG]');
    }
  });

  it('should start quickly for rapid deployment', async () => {
    const startTime = Date.now();
    
    // Kill existing process
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Start new server
    serverProcess = spawn('node', [
      path.join(process.cwd(), 'signaling-server', 'server.js'),
      '--emergency',
      '--port', (serverPort + 1).toString()
    ]);
    
    // Wait for server to be ready
    let isReady = false;
    const maxWait = 5000; // 5 seconds max
    
    while (!isReady && (Date.now() - startTime) < maxWait) {
      try {
        const response = await fetch(`http://localhost:${serverPort + 1}/health`);
        if (response.ok) {
          isReady = true;
        }
      } catch {
        // Not ready yet
      }
      
      if (!isReady) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const startupTime = Date.now() - startTime;
    expect(isReady).toBe(true);
    expect(startupTime).toBeLessThan(3000); // Should start within 3 seconds
  });
});