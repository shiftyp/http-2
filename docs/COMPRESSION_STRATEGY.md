# Frontend Compression Strategy for HTTP-over-Radio

## HTML Optimization

### Template-Based Compression
Instead of sending full HTML, send template IDs with data:
```json
{
  "t": "blog",
  "d": {
    "title": "Ham Radio News",
    "content": "...",
    "date": "2024-01-15"
  }
}
```

The PWA stores common templates locally and reconstructs HTML client-side.

### HTML Minification
- Remove all whitespace, comments
- Use shortest possible tags (`<b>` not `<strong>`)
- Omit optional closing tags
- Use HTML entities for repeated strings
- Single-letter class names

### Delta Encoding
For page updates, send only diffs:
```json
{
  "op": "replace",
  "path": "#content",
  "html": "<p>New content</p>"
}
```

## CSS Optimization

### Atomic CSS
Pre-generate single-purpose classes stored locally:
```css
.m1{margin:1px}.p1{padding:1px}.tc{text-align:center}
```

Send only class combinations:
```json
{"classes": "m1 p1 tc"}
```

### CSS-in-JSON
Send styles as compact JSON:
```json
{
  "s": {
    "bg": "#fff",
    "c": "#000",
    "m": [10, 20],
    "f": "14/1.5"
  }
}
```

### Style Dictionaries
Reference pre-stored style sets by ID:
```json
{"style": 42}  // References locally stored style #42
```

## JavaScript Optimization

### Code Splitting by Frequency
- **Core** (shipped once): Framework, common utilities
- **Templates** (cached): Page-specific logic
- **Data** (per request): Just the dynamic content

### Function References
Instead of sending JavaScript, send function IDs:
```json
{
  "init": [14, 28, 92],  // Run functions 14, 28, 92
  "events": {
    "#btn": [45]  // Attach function 45 to button
  }
}
```

### WebAssembly for Heavy Logic
Pre-compile compute-intensive code to WASM, ship binary once.

## Compression Techniques

### Dictionary Compression
Build domain-specific dictionaries:
```javascript
const hamDict = {
  0: "frequency",
  1: "callsign", 
  2: "QSO",
  3: "73",
  // ... hundreds of ham radio terms
};
```

Send indices instead of strings:
```json
{"msg": [1, "KJ4ABC", 2, "complete", 3]}
// Expands to: "callsign KJ4ABC QSO complete 73"
```

### Brotli Compression
Use Brotli with custom dictionary:
- 20-30% better than gzip
- Pre-shared dictionary for ham radio terms
- Stream-friendly for partial loading

### Binary Protocols
Define binary format for common structures:
```
[Type:1][Length:2][Data:n]
0x01 = HTML fragment
0x02 = JSON data  
0x03 = Style update
0x04 = Script reference
```

## Progressive Enhancement

### Critical Path First
1. Send minimal HTML structure (< 1KB)
2. Send critical inline CSS (< 500 bytes)
3. Send content
4. Send enhancement JS (optional)

### Lazy Loading
```json
{
  "immediate": {"title": "Hello"},
  "lazy": [
    {"id": "img1", "after": 5000},
    {"id": "comments", "on": "scroll"}
  ]
}
```

## Caching Strategy

### Fingerprinted Resources
```json
{
  "html": "tpl_v3",
  "css": "main_v7",
  "js": "app_v12"
}
```

Only transmit when version changes.

### Predictive Prefetching
Based on navigation patterns, prefetch likely next pages during idle.

## Bandwidth-Adaptive Loading

### SNR-Based Quality
```javascript
if (snr > 20) {
  // Send full experience
  return { html: full, css: full, images: true };
} else if (snr > 10) {
  // Send optimized version
  return { html: minified, css: critical, images: false };
} else {
  // Send text only
  return { html: text, css: none, images: false };
}
```

### Progressive JPEG
For images, send:
1. 4x4 preview (100 bytes)
2. 32x32 thumbnail (1 KB) 
3. Full image (if bandwidth allows)

## Implementation Example

### Original HTML (5KB)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Amateur Radio Station KJ4ABC</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>Welcome to KJ4ABC</h1>
        <nav>
            <a href="/">Home</a>
            <a href="/log">Logbook</a>
        </nav>
    </header>
    <main>
        <article>
            <h2>Recent Contacts</h2>
            <p>Made contact with VK3ABC on 20m...</p>
        </article>
    </main>
</body>
</html>
```

### Optimized Transmission (500 bytes)
```json
{
  "t": 1,
  "d": {
    "c": "KJ4ABC",
    "m": [
      [2, "Recent Contacts"],
      [3, "Made contact with VK3ABC on 20m..."]
    ]
  },
  "s": 15
}
```

### Result
- **Original**: 5 KB = 40 seconds at HTTP-1000
- **Optimized**: 0.5 KB = 4 seconds at HTTP-1000
- **Improvement**: 10x faster

## Estimated Performance Gains

With all optimizations:

### HTTP-1000 (750 bps)
- Basic page: ~5-10 seconds (vs 107)
- Blog post: ~20-30 seconds (vs 270)
- Form page: ~8-15 seconds (vs 160)

### HTTP-4800 (3600 bps)
- Basic page: ~1-2 seconds (vs 22)
- Blog post: ~5-8 seconds (vs 56)
- Form page: ~2-3 seconds (vs 33)

### HTTP-11200 (8400 bps)
- Basic page: < 1 second (vs 10)
- Blog post: ~2-3 seconds (vs 24)
- Full modern page: ~8-12 seconds (vs 96)

## Next Steps

1. Build template registry system
2. Create HTML/CSS/JS compressor
3. Implement binary protocol parser
4. Add dictionary management
5. Create bandwidth-adaptive loader