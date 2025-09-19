# Data Model: Rich Media Components

## Core Entities

### MediaComponent
The primary entity representing any rich media element in a page.

```typescript
interface MediaComponent {
  // Identification
  id: string;                    // Unique identifier (UUID)
  type: MediaType;               // IMAGE | AUDIO | VIDEO | DOCUMENT

  // Grid positioning
  grid: GridPosition;

  // Content
  source: MediaSource;

  // Transmission
  transmission: TransmissionState;

  // Display
  display: DisplayProperties;

  // Metadata
  created: Date;
  modified: Date;
  operator: string;              // Callsign of creator
}
```

### MediaType
Enumeration of supported media types.

```typescript
enum MediaType {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT'
}
```

### GridPosition
Position and size within the page grid.

```typescript
interface GridPosition {
  x: number;        // Grid column (0-11)
  y: number;        // Grid row (0+)
  width: number;    // Columns span (1-12)
  height: number;   // Rows span (1+)
}
```

### MediaSource
Binary data and metadata for the media content.

```typescript
interface MediaSource {
  // Original upload
  original: {
    blob: Blob;
    size: number;           // Bytes
    format: string;         // MIME type
    dimensions?: {          // For images/video
      width: number;
      height: number;
    };
    duration?: number;      // For audio/video (seconds)
    pages?: number;         // For documents
  };

  // Compressed version
  compressed: {
    blob: Blob;
    size: number;
    format: string;
    compressionRatio: number;  // 0.0 - 1.0
    profile: CompressionProfile;
  };

  // Chunks for transmission
  chunks: MediaChunk[];

  // Integrity
  checksum: string;         // SHA-256 hash
  signature: string;        // ECDSA signature
}
```

### CompressionProfile
Compression settings used.

```typescript
enum CompressionProfile {
  EMERGENCY = 'emergency',   // 10-20KB target
  STANDARD = 'standard',     // 30-50KB target
  QUALITY = 'quality'        // 60-100KB target
}
```

### MediaChunk
Individual chunk for parallel transmission.

```typescript
interface MediaChunk {
  index: number;            // Chunk number (0-based)
  total: number;            // Total chunks
  size: number;             // Bytes in this chunk
  data: ArrayBuffer;        // Binary data
  hash: string;             // SHA-256 of chunk
}
```

### TransmissionState
Current transmission status and progress.

```typescript
interface TransmissionState {
  status: TransmissionStatus;
  priority: Priority;
  progress: number;         // 0-100 percentage
  chunksTransmitted: number;
  totalChunks: number;
  startTime?: Date;
  completionTime?: Date;
  estimatedTimeRemaining?: number;  // Seconds
  assignedSubcarriers?: number;     // OFDM carriers
  retryCount: number;
  errors: TransmissionError[];
}

enum TransmissionStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  TRANSMITTING = 'transmitting',
  COMPLETE = 'complete',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

enum Priority {
  EMERGENCY = 'emergency',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low'
}

interface TransmissionError {
  timestamp: Date;
  message: string;
  chunkIndex?: number;
}
```

### DisplayProperties
How the media is displayed to users.

```typescript
interface DisplayProperties {
  // Fallback for transmission/display failure
  fallbackText: string;
  altText?: string;         // Accessibility
  caption?: string;         // User-provided caption

  // Progressive loading
  thumbnail?: Blob;         // Small preview
  progressive: ProgressiveLevel[];

  // Presentation
  autoplay?: boolean;       // For audio/video
  loop?: boolean;           // For audio/video
  controls?: boolean;       // Show media controls
  muted?: boolean;          // Start muted
}

interface ProgressiveLevel {
  quality: number;          // 0-100 percentage
  blob: Blob;
  size: number;
}
```

## Supporting Entities

### MediaGallery
Collection of all media in the system.

```typescript
interface MediaGallery {
  items: MediaGalleryItem[];
  totalSize: number;        // Total cache size in bytes
  maxSize: number;          // Maximum allowed size
}

interface MediaGalleryItem {
  mediaId: string;
  component: MediaComponent;
  pageId?: string;          // Page containing this media
  lastAccessed: Date;
  accessCount: number;
  pinned: boolean;          // Prevent auto-eviction
  receivedFrom?: string;    // Callsign if received
  transmittedTo: string[];  // Callsigns transmitted to
}
```

### YAMLComponent
YAML representation of a media component for transmission.

```typescript
interface YAMLComponent {
  type: string;
  id: string;
  grid: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  props: {
    src: string;            // Media ID reference
    alt?: string;
    caption?: string;
    compression: string;
    priority: string;
    chunks: number;
    size: number;
    checksum: string;
  };
}
```

### MediaQueue
Transmission queue management.

```typescript
interface MediaQueue {
  items: QueueItem[];
  processingItem?: QueueItem;
}

interface QueueItem {
  mediaId: string;
  priority: Priority;
  addedAt: Date;
  position: number;
  estimatedTransmitTime?: Date;
  targetCallsign?: string;  // If specific destination
}
```

### CodecConfiguration
Settings for WebAssembly codecs.

```typescript
interface CodecConfiguration {
  image: {
    mozjpeg: {
      quality: number;      // 1-100
      progressive: boolean;
      optimize: boolean;
    };
    webp: {
      quality: number;      // 1-100
      method: number;       // 0-6 (compression effort)
      lossless: boolean;
    };
  };
  audio: {
    opus: {
      bitrate: number;      // 8000-24000
      complexity: number;   // 0-10
      vbr: boolean;         // Variable bitrate
    };
  };
  video: {
    keyframeInterval: number;  // Frames between keyframes
    maxKeyframes: number;       // Total keyframes to extract
  };
  document: {
    dpi: number;            // PDF rendering resolution
    format: 'jpeg' | 'png';
  };
}
```

## Validation Rules

### MediaComponent Validation
- `id`: Must be valid UUID v4
- `type`: Must be one of defined MediaType values
- `grid`: x ∈ [0,11], y ≥ 0, width ∈ [1,12], height ≥ 1
- `source.compressed.size`: Must be ≤ 102400 bytes (100KB)
- `source.checksum`: Must be valid SHA-256 hash
- `operator`: Must be valid amateur radio callsign

### Transmission Validation
- `priority`: Emergency only if operator authorized
- `progress`: Must be 0-100
- `chunksTransmitted`: Must be ≤ totalChunks
- `assignedSubcarriers`: Must be ≤ 48

### Content Validation
- No commercial content (music, copyrighted material)
- Third-party content must be marked
- Emergency content requires manual verification
- Adult content prohibited per FCC rules

## State Transitions

### MediaComponent Lifecycle
```
CREATED → COMPRESSING → COMPRESSED → QUEUED → TRANSMITTING → COMPLETE
                ↓            ↓           ↓          ↓
              FAILED      FAILED      FAILED     FAILED
```

### Chunk Transmission States
```
PENDING → ASSIGNED → TRANSMITTING → ACKNOWLEDGED
             ↓            ↓              ↓
          TIMEOUT      CORRUPTED      RETRY
```

## Relationships

### Component-Page Relationship
- A MediaComponent belongs to exactly one Page
- A Page can contain 0-n MediaComponents
- Deleting a Page deletes all its MediaComponents

### Component-Gallery Relationship
- Every MediaComponent exists in the MediaGallery
- Gallery items can exist without a Page (received media)
- Gallery maintains usage statistics for cache management

### Component-Queue Relationship
- A MediaComponent can have 0-1 QueueItem
- QueueItems are removed after transmission
- Failed transmissions create new QueueItems

## Indexes

### Primary Indexes
- `mediaComponents.id` - Primary key
- `mediaGallery.mediaId` - Unique index
- `mediaQueue.mediaId` - Unique when present

### Search Indexes
- `mediaComponents.type` - Filter by media type
- `mediaComponents.operator` - Find by creator
- `mediaGallery.pinned` - Find pinned items
- `mediaQueue.priority` - Order by priority
- `transmission.status` - Find active transmissions

## Storage Estimates

### Per MediaComponent
- Metadata: ~2KB
- Thumbnail: ~5KB
- Progressive levels (3): ~30KB
- Compressed media: ≤100KB
- **Total**: ~140KB maximum

### System Capacity
- Target: 1000 media items
- Storage requirement: ~140MB
- Recommended cache size: 200MB
- Minimum viable: 50MB

---
*Data model version 1.0.0*