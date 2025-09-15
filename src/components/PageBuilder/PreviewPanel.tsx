import React, { useState } from 'react';
import { Card, CardContent } from '../ui/Card';

interface PreviewPanelProps {
  html: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ html }) => {
  const [deviceSize, setDeviceSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  const getPreviewWidth = () => {
    switch (deviceSize) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      case 'desktop':
        return '100%';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Device selector */}
      <div className="mb-4 flex items-center space-x-4">
        <label className="text-sm font-medium">Preview Device:</label>
        <select
          value={deviceSize}
          onChange={(e) => setDeviceSize(e.target.value as 'mobile' | 'tablet' | 'desktop')}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
        >
          <option value="mobile">Mobile (375px)</option>
          <option value="tablet">Tablet (768px)</option>
          <option value="desktop">Desktop (Full)</option>
        </select>
      </div>

      {/* Preview frame */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full p-0">
          <div
            className="h-full mx-auto bg-white transition-all duration-300"
            style={{ width: getPreviewWidth() }}
          >
            <iframe
              srcDoc={`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    * {
                      margin: 0;
                      padding: 0;
                      box-sizing: border-box;
                    }
                    body {
                      font-family: monospace;
                      line-height: 1.6;
                      color: #333;
                      padding: 20px;
                      background: white;
                    }
                    h1, h2, h3 {
                      margin-bottom: 0.5em;
                    }
                    p {
                      margin-bottom: 1em;
                    }
                    button {
                      padding: 8px 16px;
                      background: #3B82F6;
                      color: white;
                      border: none;
                      border-radius: 4px;
                      cursor: pointer;
                    }
                    button:hover {
                      background: #2563EB;
                    }
                    input {
                      padding: 8px 12px;
                      border: 1px solid #ccc;
                      border-radius: 4px;
                      width: 100%;
                      max-width: 300px;
                    }
                    a {
                      color: #3B82F6;
                      text-decoration: none;
                    }
                    a:hover {
                      text-decoration: underline;
                    }
                    hr {
                      margin: 20px 0;
                      border: none;
                      border-top: 1px solid #e5e5e5;
                    }
                    .page-container {
                      max-width: 800px;
                      margin: 0 auto;
                    }
                  </style>
                </head>
                <body>
                  ${html}
                </body>
                </html>
              `}
              className="w-full h-full border-0"
              title="Page Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </CardContent>
      </Card>

      {/* HTML Source */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium mb-2">
          View HTML Source
        </summary>
        <pre className="bg-gray-800 p-4 rounded overflow-x-auto text-xs">
          <code>{html}</code>
        </pre>
      </details>
    </div>
  );
};