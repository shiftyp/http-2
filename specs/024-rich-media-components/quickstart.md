# Quickstart: Rich Media Components

## Overview
This guide walks through adding rich media components to pages in the ham radio visual page builder, from upload to transmission.

## Prerequisites
- Visual page builder running in browser
- OFDM transmission capability enabled
- Valid amateur radio callsign configured
- 100MB+ available storage for media cache

## Step 1: Add an Image Component

### 1.1 Open Page Builder
```javascript
// Navigate to page builder
window.location.href = '/builder';
```

### 1.2 Drag Image Component
1. Open component palette (left sidebar)
2. Find "IMAGE" component
3. Drag onto grid canvas
4. Drop in desired position (component will snap to grid)

### 1.3 Upload Image
1. Click the dropped image component
2. Property editor modal opens
3. Click "Upload Image" button
4. Select image file (JPEG, PNG, or WebP)
5. Choose compression profile:
   - **Emergency**: Fastest, lowest quality (10-20KB)
   - **Standard**: Balanced (30-50KB)
   - **Quality**: Best quality (60-100KB)

### 1.4 Configure Properties
```yaml
# Generated component structure
type: IMAGE
id: img_001
grid: {x: 2, y: 1, w: 4, h: 3}
props:
  src: emergency_photo.jpg
  alt: "Bridge damage on Route 95"
  caption: "Avoid this area"
  compression: standard
  priority: high
```

## Step 2: Add Audio Component

### 2.1 Drag Audio Component
1. Select "AUDIO" from component palette
2. Drag to grid position
3. Component appears as audio player widget

### 2.2 Record or Upload Audio
```javascript
// Recording option
const recorder = new MediaRecorder(stream);
recorder.start();
// ... record up to 30 seconds
recorder.stop();

// Upload option
<input type="file" accept="audio/*" />
```

### 2.3 Audio Compression
- Automatic Opus encoding at 16 kbps
- 30 seconds ≈ 60KB
- Voice optimization applied

## Step 3: Add Video Component (Keyframes)

### 3.1 Video Upload
1. Drag "VIDEO" component to grid
2. Upload video file
3. System extracts keyframes automatically
4. Only keyframes transmitted (not full video)

### 3.2 Keyframe Preview
```javascript
// Extracted keyframes displayed as slideshow
keyframes: [
  {time: 0, image: "frame_000.jpg"},
  {time: 5, image: "frame_005.jpg"},
  {time: 10, image: "frame_010.jpg"}
]
```

## Step 4: Add Document Component

### 4.1 PDF Upload
1. Drag "DOCUMENT" component
2. Upload PDF file
3. System renders pages as images
4. Progressive page loading supported

### 4.2 Document Display
```yaml
type: DOCUMENT
props:
  src: emergency_plan.pdf
  pages: 5
  currentPage: 1
  renderQuality: standard
```

## Step 5: Preview YAML Output

### 5.1 Open YAML Preview
```javascript
// Click "YAML Preview" button in toolbar
const yaml = serializeComponents(pageComponents);
console.log(yaml);
```

### 5.2 Example Output
```yaml
page:
  id: page_2024_001
  title: Emergency Update
  created: 2024-01-15T10:30:00Z
  components:
    - type: HEADING
      text: EMERGENCY BROADCAST
      level: 1
    - type: IMAGE
      id: img_001
      grid: {x: 0, y: 1, w: 6, h: 4}
      props:
        src: damage_photo.jpg
        alt: Bridge damage
        compression: emergency
        chunks: 8
    - type: AUDIO
      id: aud_001
      grid: {x: 6, y: 1, w: 6, h: 2}
      props:
        src: announcement.opus
        duration: 15
        autoplay: true
    - type: TEXT
      content: "Avoid Route 95 northbound..."
  metadata:
    priority: emergency
    size: 42358
    operator: KA1ABC
```

## Step 6: Transmit via OFDM

### 6.1 Queue for Transmission
```javascript
// Queue media for transmission
await queueMedia({
  mediaId: 'img_001',
  priority: 'emergency'
});
```

### 6.2 Monitor Progress
```javascript
// Subscribe to progress updates
const eventSource = new EventSource('/api/transmission/progress/img_001');
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  console.log(`Progress: ${progress.percent}%`);
  console.log(`Chunks: ${progress.chunksTransmitted}/${progress.totalChunks}`);
  console.log(`Subcarriers: ${progress.assignedSubcarriers}`);
};
```

### 6.3 OFDM Allocation Display
```
Subcarrier Allocation (48 total):
[1-12]: Client KA1ABC - Image chunks 1-4
[13-24]: Client KB2XYZ - Audio chunks 1-3
[25-36]: Client KC3DEF - Document pages 1-2
[37-48]: Available
```

## Step 7: Verify Reception

### 7.1 Check Transmission Status
```javascript
const status = await fetch('/api/transmission/status/img_001');
// Status: complete, chunks: 8/8, time: 4.2s
```

### 7.2 View in Gallery
1. Open Media Gallery (Tools → Media Gallery)
2. Filter by type or date
3. See all transmitted/received media
4. Pin important items to prevent cache eviction

## Step 8: Manage Cache

### 8.1 View Cache Status
```javascript
const cache = await getMediaCache();
console.log(`Used: ${cache.used}MB / ${cache.max}MB`);
console.log(`Items: ${cache.items.length}`);
```

### 8.2 Clear Old Media
```javascript
// Clear media older than 7 days (except pinned)
await clearCache({
  olderThan: '7d',
  keepPinned: true
});
```

## Troubleshooting

### Issue: Compression Fails
**Solution**: Image too complex, try:
1. Reduce resolution before upload
2. Use Emergency profile
3. Convert to simpler format (JPEG instead of PNG)

### Issue: Transmission Stalls
**Solution**: Check:
1. OFDM mode is active
2. Sufficient subcarriers available
3. No higher priority transmissions queued

### Issue: Progressive Loading Not Working
**Solution**: Ensure:
1. Chunks arriving in order
2. Sufficient chunks received (>20%)
3. Codec supports progressive decoding

## Testing Emergency Broadcast

### Complete Emergency Page Test
```javascript
// 1. Create page with emergency content
const page = {
  title: "EMERGENCY - Flash Flood Warning",
  components: [
    {
      type: 'IMAGE',
      props: {
        src: 'flood_map.jpg',
        compression: 'emergency',
        priority: 'emergency'
      }
    },
    {
      type: 'AUDIO',
      props: {
        src: 'warning_message.opus',
        autoplay: true,
        priority: 'emergency'
      }
    }
  ]
};

// 2. Serialize to YAML
const yaml = await serializeComponents(page);

// 3. Queue for immediate transmission
await queueTransmission({
  content: yaml,
  priority: 'emergency'
});

// 4. Monitor transmission
const monitor = setInterval(async () => {
  const status = await getTransmissionStatus();
  if (status.complete) {
    console.log('Emergency broadcast complete');
    clearInterval(monitor);
  }
}, 1000);
```

## Performance Expectations

### Compression Times
- Small image (< 500KB): 1-2 seconds
- Large image (1-5MB): 3-5 seconds
- Audio (30s): < 1 second
- PDF (10 pages): 2-3 seconds

### Transmission Times (OFDM @ 100 kbps)
- 20KB emergency image: 1.6 seconds
- 50KB standard image: 4 seconds
- 100KB quality image: 8 seconds
- 100KB audio file: 8 seconds

### Progressive Display
- First preview: < 2 seconds
- Recognizable quality: < 5 seconds
- Full quality: Based on file size

## Best Practices

1. **Always Test Compression First**
   - Preview before transmitting
   - Check file size meets limits
   - Verify quality is acceptable

2. **Use Appropriate Profiles**
   - Emergency: Life safety only
   - Standard: Most content
   - Quality: When detail matters

3. **Optimize Before Upload**
   - Resize images to needed dimensions
   - Trim audio to essential content
   - Extract only necessary PDF pages

4. **Monitor Bandwidth Usage**
   - Check session bandwidth meter
   - Queue non-urgent media for off-peak
   - Use gallery for frequently needed media

5. **Validate FCC Compliance**
   - Mark third-party content
   - No commercial material
   - Include station ID in metadata

---
*Version 1.0.0 - Rich Media Components Quickstart*