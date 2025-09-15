# Ham Radio WebRTC Signaling Server

Native WebSocket signaling server for ham radio WebRTC connections. Provides peer discovery and SDP relay for internet-based WebRTC connections between amateur radio stations.

## Features

- **Native WebSocket**: Uses Node.js built-in WebSocket (ws library) - no Socket.io dependencies
- **Callsign-based Rooms**: Automatic network organization by amateur radio callsigns
- **SDP Relay**: Handles WebRTC offer/answer exchange and ICE candidate relay
- **Health Monitoring**: Built-in health checks and connection statistics
- **Lightweight**: Minimal dependencies, designed for reliable operation
- **FCC Compliance**: Maintains amateur radio station identification requirements

## Quick Start

### Installation

```bash
cd signaling-server
npm install
```

### Running the Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

The server will start on port 8080 by default.

### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "networks": 0,
  "stations": 0,
  "uptime": 34.77
}
```

### Statistics

```bash
curl http://localhost:8080/stats
```

## WebSocket Protocol

### Connection Flow

1. **Connect**: WebSocket connection to `ws://server:8080`
2. **Register**: Send registration message with callsign
3. **Join Network**: Join a network room (default: "default")
4. **Peer Discovery**: Request list of available peers
5. **WebRTC Signaling**: Exchange offers, answers, and ICE candidates

### Message Types

#### Client → Server

**Register Station**
```json
{
  "type": "register",
  "callsign": "KA1ABC",
  "capabilities": ["content-download", "content-upload", "mesh-routing"]
}
```

**Join Network**
```json
{
  "type": "join-network",
  "networkName": "emergency-net"
}
```

**WebRTC Offer**
```json
{
  "type": "offer",
  "targetCallsign": "KB2DEF",
  "offer": {
    "type": "offer",
    "sdp": "..."
  }
}
```

**WebRTC Answer**
```json
{
  "type": "answer",
  "targetCallsign": "KA1ABC",
  "answer": {
    "type": "answer",
    "sdp": "..."
  }
}
```

**ICE Candidate**
```json
{
  "type": "ice-candidate",
  "targetCallsign": "KB2DEF",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

**Request Peer List**
```json
{
  "type": "request-peers",
  "networkName": "emergency-net"
}
```

**Heartbeat**
```json
{
  "type": "heartbeat"
}
```

#### Server → Client

**Welcome**
```json
{
  "type": "welcome",
  "server": "Ham Radio WebRTC Signaling",
  "version": "1.0.0",
  "timestamp": "2025-09-15T17:54:16.438Z"
}
```

**Registration Confirmed**
```json
{
  "type": "registered",
  "callsign": "KA1ABC",
  "stationId": "uuid-here",
  "timestamp": "2025-09-15T17:54:16.438Z"
}
```

**Network Joined**
```json
{
  "type": "network-joined",
  "networkName": "emergency-net",
  "peers": [
    {
      "callsign": "KB2DEF",
      "capabilities": ["content-download"],
      "connectedAt": "2025-09-15T17:54:16.438Z"
    }
  ]
}
```

**Peer List**
```json
{
  "type": "peer-list",
  "peers": [
    {
      "callsign": "KB2DEF",
      "capabilities": ["content-download", "content-upload"],
      "connectedAt": "2025-09-15T17:54:16.438Z"
    }
  ]
}
```

**Error**
```json
{
  "type": "error",
  "message": "Invalid callsign format",
  "timestamp": "2025-09-15T17:54:16.438Z"
}
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (production/development)

### Callsign Validation

The server validates amateur radio callsigns using the pattern: `/^[A-Z0-9]{2,}[0-9][A-Z]{1,4}$/`

Supported formats:
- US: `KA1ABC`, `N0DEF`, `W5XYZ`
- International: `VK3ABC`, `G0DEF`, `JA1XYZ`
- Special: `K1ABC/P`, `VK3ABC/MM`

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./
EXPOSE 8080

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  signaling:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Systemd Service

```ini
[Unit]
Description=Ham Radio WebRTC Signaling Server
After=network.target

[Service]
Type=simple
User=signaling
WorkingDirectory=/opt/signaling-server
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name signaling.hamradio.example.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring

### Health Checks

The server provides health check endpoints for monitoring:

- `GET /health`: Basic health status
- `GET /stats`: Detailed statistics including network and station counts

### Logging

The server logs all connection events and errors to console. In production, pipe to a logging service:

```bash
npm start | tee -a /var/log/signaling-server.log
```

### Metrics

Key metrics to monitor:

- Active WebSocket connections
- Number of networks and stations
- Connection/disconnection rates
- Error rates
- Memory usage
- CPU usage

## Security Considerations

### Amateur Radio Compliance

- Station identification is handled by clients, not the signaling server
- No content encryption (FCC Part 97 compliance)
- All communications logged for regulatory compliance

### Network Security

- Use HTTPS/WSS in production
- Implement rate limiting for production deployments
- Monitor for abuse and implement IP blocking if needed
- Consider authentication for private networks

### Firewall Configuration

Open ports:
- TCP 8080 (or configured port) for WebSocket connections
- Consider using standard HTTPS port 443 with reverse proxy

## Troubleshooting

### Common Issues

**Connection Refused**
- Check if server is running: `curl http://localhost:8080/health`
- Verify port is not blocked by firewall
- Check server logs for error messages

**WebRTC Connection Failures**
- Verify both clients can connect to signaling server
- Check if WebRTC offer/answer exchange is completing
- Ensure STUN servers are accessible for NAT traversal

**High Memory Usage**
- Monitor connection counts with `/stats` endpoint
- Check for connection leaks (connections not properly closed)
- Restart server if memory usage continues growing

### Debug Mode

Run with additional logging:

```bash
DEBUG=* npm start
```

## API Integration

### JavaScript Client Example

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  // Register station
  ws.send(JSON.stringify({
    type: 'register',
    callsign: 'KA1ABC',
    capabilities: ['content-download', 'content-upload']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'registered':
      console.log('Registration confirmed');
      // Join default network
      ws.send(JSON.stringify({
        type: 'join-network'
      }));
      break;

    case 'network-joined':
      console.log('Network joined, peers:', message.peers);
      break;

    case 'offer':
      // Handle WebRTC offer
      handleWebRTCOffer(message.offer, message.fromCallsign);
      break;
  }
};
```

## License

MIT License - See LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: [ham-radio/webrtc-signaling/issues]
- Ham Radio Forums: Technical discussion
- Emergency Networks: Critical deployment support