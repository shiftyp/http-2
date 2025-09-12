# Content Architecture: Static Pages vs Server Functions

## Overview
The system separates static content (pages) from dynamic functionality (server functions). Users can create both static pages (in Markdown or HTML) and serverless functions that handle dynamic requests. This separation ensures ease of use while providing powerful functionality.

## Content Types

### 1. Static Pages
Simple content that doesn't require processing:

#### Markdown Pages
```markdown
---
title: Emergency Information
author: KA1ABC
created: 2024-01-15
---

# Emergency Contact Information

**Location**: Grid Square FN31pr  
**Status**: All OK

## Local Resources
- Hospital: 146.520 MHz
- Fire: 146.550 MHz
- Police: 146.580 MHz

[Contact Form](/functions/contact)
```

#### HTML Pages
```html
<!DOCTYPE html>
<html>
<head>
    <title>KA1ABC Station Page</title>
    <style>
        body { font-family: monospace; max-width: 600px; }
    </style>
</head>
<body>
    <h1>Welcome to KA1ABC</h1>
    <p>QTH: Grid Square FN31pr</p>
    
    <!-- Form submits to a server function -->
    <form method="POST" action="/functions/guestbook">
        <input name="callsign" placeholder="Your Callsign" required>
        <textarea name="message" placeholder="Leave a message"></textarea>
        <button type="submit">Sign Guestbook</button>
    </form>
    
    <!-- Link to static page -->
    <a href="/pages/about.html">About Me</a>
</body>
</html>
```

### 2. Server Functions (FaaS Model)
Lightweight functions that handle specific endpoints:

```javascript
// Function: /functions/contact
export default async function handleContact(request, context) {
  const { method, body, query } = request;
  const { store, crypto, respond } = context;
  
  if (method === 'GET') {
    return respond.html(`
      <form method="POST" action="/functions/contact">
        <input name="from" required>
        <textarea name="message" required></textarea>
        <button>Send</button>
      </form>
    `);
  }
  
  if (method === 'POST') {
    // Store message
    await store.add('messages', {
      from: body.from,
      message: body.message,
      timestamp: Date.now()
    });
    
    return respond.redirect('/pages/thanks.html');
  }
}
```

## URL Structure

```
http://CALLSIGN.radio/
├── /                          # Homepage (static page)
├── /pages/                    # Static pages
│   ├── /pages/about.html     # HTML page
│   ├── /pages/info.md        # Markdown page
│   └── /pages/emergency.html # Emergency info
└── /functions/                # Server functions
    ├── /functions/contact     # Contact form handler
    ├── /functions/guestbook   # Guestbook function
    └── /functions/api/data    # API endpoint
```

## Content Creation Interface

### Page Editor
```
┌─────────────────────────────────────────┐
│          Create Page                     │
├─────────────────────────────────────────┤
│ Path: /pages/[about.html_____]          │
│                                         │
│ Format: [▼ HTML | Markdown ]            │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ # About KA1ABC                      │ │
│ │                                     │ │
│ │ I'm a ham radio operator in Boston. │ │
│ │                                     │ │
│ │ ## Interests                        │ │
│ │ - Digital modes                     │ │
│ │ - Emergency communications          │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Preview] [Save] [Publish]              │
└─────────────────────────────────────────┘
```

### Function Editor
```
┌─────────────────────────────────────────┐
│       Create Server Function            │
├─────────────────────────────────────────┤
│ Path: /functions/[guestbook____]        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ export default async (req, ctx) => {│ │
│ │   const { store, respond } = ctx;   │ │
│ │                                     │ │
│ │   if (req.method === 'GET') {      │ │
│ │     const entries = await          │ │
│ │       store.getAll('entries');     │ │
│ │     return respond.html(           │ │
│ │       renderGuestbook(entries)     │ │
│ │     );                             │ │
│ │   }                                │ │
│ │ }                                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Test] [Deploy] [View Logs]             │
└─────────────────────────────────────────┘
```

## Function Context API

Each function receives a context object with utilities:

```typescript
interface FunctionContext {
  // Data storage (isolated per function)
  store: {
    get(key: string): Promise<any>
    set(key: string, value: any): Promise<void>
    delete(key: string): Promise<void>
    getAll(prefix?: string): Promise<any[]>
    add(collection: string, item: any): Promise<void>
  }
  
  // Response helpers
  respond: {
    html(content: string, status?: number): Response
    json(data: any, status?: number): Response
    text(content: string, status?: number): Response
    redirect(url: string, status?: number): Response
    error(message: string, status?: number): Response
  }
  
  // Crypto utilities
  crypto: {
    hash(data: string): Promise<string>
    randomUUID(): string
    verify(signature: string, data: string): Promise<boolean>
  }
  
  // Request info
  request: {
    method: string
    path: string
    query: Record<string, string>
    body: any
    headers: Record<string, string>
    fromCallsign: string
    authenticated: boolean
    trustLevel: number
  }
}
```

## Markdown Rendering

Markdown pages are rendered with:
- GitHub Flavored Markdown support
- Frontmatter for metadata
- Automatic table of contents
- Syntax highlighting for code blocks
- Link rewriting for radio URLs

```javascript
class MarkdownRenderer {
  render(markdown) {
    // Parse frontmatter
    const { attributes, body } = frontmatter(markdown);
    
    // Convert to HTML
    const html = marked.parse(body, {
      gfm: true,
      breaks: true,
      highlight: (code, lang) => hljs.highlight(code, { language: lang }).value
    });
    
    // Rewrite links
    const processed = html.replace(
      /href="\/([^"]+)"/g,
      'href="http://' + callsign + '.radio/$1"'
    );
    
    return wrapInTemplate(processed, attributes);
  }
}
```

## Storage Structure

```
IndexedDB
├── static-pages/
│   ├── /index.html
│   ├── /pages/about.md
│   ├── /pages/emergency.html
│   └── /pages/resources.md
├── server-functions/
│   ├── /functions/contact
│   ├── /functions/guestbook
│   └── /functions/api/data
└── function-data/
    ├── contact/
    │   └── messages: [...]
    └── guestbook/
        └── entries: [...]
```

## Function Examples

### Simple Counter
```javascript
// /functions/counter
export default async (req, ctx) => {
  const count = (await ctx.store.get('count')) || 0;
  
  if (req.method === 'POST') {
    await ctx.store.set('count', count + 1);
    return ctx.respond.redirect('/functions/counter');
  }
  
  return ctx.respond.html(`
    <h1>Counter: ${count}</h1>
    <form method="POST">
      <button>Increment</button>
    </form>
  `);
};
```

### API Endpoint
```javascript
// /functions/api/status
export default async (req, ctx) => {
  const status = {
    callsign: 'KA1ABC',
    grid: 'FN31pr',
    online: true,
    timestamp: Date.now()
  };
  
  return ctx.respond.json(status);
};
```

### File Upload Handler
```javascript
// /functions/upload
export default async (req, ctx) => {
  if (req.method === 'POST') {
    const file = req.body.file;
    
    // Store file metadata
    await ctx.store.add('files', {
      name: file.name,
      size: file.size,
      type: file.type,
      data: file.data,
      uploaded: Date.now()
    });
    
    return ctx.respond.html('File uploaded successfully!');
  }
  
  return ctx.respond.html(`
    <form method="POST" enctype="multipart/form-data">
      <input type="file" name="file" required>
      <button>Upload</button>
    </form>
  `);
};
```

## Benefits of Separation

1. **Simplicity**: Static pages are just files, no code needed
2. **Performance**: Static content served directly, no processing
3. **Flexibility**: Mix static and dynamic content easily
4. **Security**: Functions run in isolated workers
5. **Portability**: Pages and functions can be exported/imported
6. **Learning Curve**: Start with static pages, add functions later

## Routing Rules

1. **Exact Match First**: `/pages/about.html` before patterns
2. **Functions Priority**: `/functions/*` handled by functions
3. **Static Fallback**: Everything else served as static
4. **404 Handling**: Custom 404 page or default

```javascript
class Router {
  async route(request) {
    const url = new URL(request.url);
    
    // Check for function
    if (url.pathname.startsWith('/functions/')) {
      return await this.executeFunction(url.pathname, request);
    }
    
    // Check for static page
    const page = await this.getStaticPage(url.pathname);
    if (page) {
      return this.serveStatic(page);
    }
    
    // 404
    return this.serve404();
  }
}
```

---
*This architecture provides the best of both worlds: simple static content and powerful serverless functions.*