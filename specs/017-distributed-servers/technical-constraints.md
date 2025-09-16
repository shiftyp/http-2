# Technical Constraints: Distributed Servers in Browser Environment

## The Problem
Browsers cannot act as traditional HTTP servers due to:
1. **No inbound connections**: Browsers can only make outbound connections
2. **No socket binding**: Cannot listen on ports
3. **WebRTC requires signaling**: Need a server to exchange SDPs for peer connections
4. **PWA sandbox**: Service Workers can't accept external requests

## Realistic Architecture Within Browser Constraints

### Option 1: RF-Only Distribution (Most Feasible)
Since we already have RF transmission capability:
- **Content Distribution**: Use RF (QPSK modem) as the "server" mechanism
- **Request/Response**: HTTP-over-radio protocol already supports this
- **Discovery**: CQ beacons on RF contain content catalogs
- **No Internet Required**: Pure RF communication between stations

**How it works:**
1. Station A broadcasts "I have content X" via RF beacon
2. Station B sends HTTP request over RF: "GET /page.html"
3. Station A responds with content over RF
4. All stations can "serve" content via their radio transmitter

### Option 2: Local Network Hybrid
For stations on same local network without internet:
- **mDNS/Bonjour**: Discover peers on local network (no internet needed)
- **Local WebSocket Server**: Run companion app outside browser
- **Fallback to RF**: When not on same local network

**Limitations:**
- Requires additional software outside the PWA
- Only works on same subnet
- Not pure browser solution

### Option 3: Mesh Network via RF Coordination
Pure browser solution using RF for coordination:
- **RF as Signaling Channel**: Exchange WebRTC SDPs over radio
- **WebRTC for Data**: Once connected, use DataChannels for bulk transfer
- **No Internet Signaling**: Radio replaces WebSocket signaling server

**How it works:**
1. Station A broadcasts WebRTC offer via RF
2. Station B receives offer, sends answer via RF
3. Establish WebRTC connection using exchanged SDPs
4. Transfer data at high speed via WebRTC
5. Fall back to pure RF if WebRTC fails

### What "Distributed Servers" Really Means Here

In our browser-constrained environment, "distributed servers" means:

1. **Content Repositories**: Each station maintains a cache of content
2. **Request Routing**: Requests route through mesh to find content
3. **Peer-to-Peer Transfer**: Content transfers between peers (not client-server)
4. **RF as Transport**: Radio acts as the network layer

The key insight: **The radio transmitter IS the server**, not the browser.

## Recommended Approach

### Primary: RF-Based Content Mesh
- Every station broadcasts content catalog periodically
- HTTP requests/responses travel over RF
- No WebRTC needed for basic operation
- Works with zero internet, zero local network

### Enhancement: RF-Coordinated WebRTC
- Use RF to exchange WebRTC connection info
- Establish high-speed peer connections when possible
- Fallback to RF when WebRTC unavailable
- Best of both worlds: RF reliability + WebRTC speed

### Architecture Components

```
[Browser PWA] <-> [Radio TX/RX] <-> [RF Network] <-> [Radio TX/RX] <-> [Browser PWA]
       |                                                                    |
       +------------------- Optional WebRTC Data Channel ------------------+
                          (Established via RF coordination)
```

## Key Clarifications for Spec

1. **"Server" means**: Station capable of providing content via RF transmission
2. **"Distributed" means**: Content spread across multiple stations
3. **"Client" means**: Station requesting content via RF
4. **No traditional servers**: All peers are equal, no listening sockets
5. **Discovery via RF**: Content catalogs broadcast on amateur bands
6. **WebRTC optional**: High-speed transfer when RF coordination succeeds

## Implementation Priority

1. **Phase 1**: Pure RF content distribution (already mostly built)
2. **Phase 2**: Content catalog synchronization via RF
3. **Phase 3**: RF-based WebRTC coordination for high-speed transfer
4. **Phase 4**: Intelligent routing and caching strategies

## Conclusion

The "distributed servers" concept needs reframing for browser reality:
- **Not**: Traditional HTTP servers listening on ports
- **Actually**: Peer-to-peer content mesh using RF as transport
- **Enhancement**: WebRTC for speed when coordination possible
- **Core principle**: Radio transmitter = server, browser = content manager