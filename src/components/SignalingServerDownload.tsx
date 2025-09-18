import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Download, Server, CheckCircle } from 'lucide-react';

interface PlatformInfo {
  platform: string;
  displayName: string;
  icon: string;
  size: string;
}

export const SignalingServerDownload: React.FC = () => {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Detect platform from user agent
    const ua = navigator.userAgent.toLowerCase();
    let platform = 'linux-x64';
    let displayName = 'Linux x64';
    let icon = '🐧';

    const isARM64 = ua.includes('arm64') || ua.includes('aarch64');

    if (ua.includes('win')) {
      platform = 'win-x64';
      displayName = 'Windows x64';
      icon = '🪟';
    } else if (ua.includes('mac') || ua.includes('darwin')) {
      platform = isARM64 ? 'macos-arm64' : 'macos-x64';
      displayName = isARM64 ? 'macOS Apple Silicon' : 'macOS Intel';
      icon = '🍎';
    } else if (ua.includes('linux')) {
      platform = isARM64 ? 'linux-arm64' : 'linux-x64';
      displayName = isARM64 ? 'Linux ARM64' : 'Linux x64';
      icon = '🐧';
    }

    setPlatformInfo({
      platform,
      displayName,
      icon,
      size: '~50 MB'
    });
  }, []);

  const handleDownload = async () => {
    if (!platformInfo) return;

    setDownloading(true);
    setProgress(0);

    try {
      // In production, this would be your download server URL
      const downloadUrl = `${import.meta.env.VITE_DOWNLOAD_SERVER_URL || 'http://localhost:3001'}/download/signaling-server`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'User-Agent': navigator.userAgent
        }
      });

      if (!response.ok) throw new Error('Download failed');

      // Get total size from headers
      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      // Read the response as a stream
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        if (total > 0) {
          setProgress((received / total) * 100);
        }
      }

      // Combine chunks and create blob
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `signaling-server-${platformInfo.platform}${platformInfo.platform.includes('win') ? '.exe' : ''}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(url);
      setProgress(100);
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed. Please check if the download server is running.');
    } finally {
      setDownloading(false);
    }
  };

  if (!platformInfo) {
    return <div>Detecting platform...</div>;
  }

  return (
    <Card className="p-6 max-w-md">
      <div className="flex items-center gap-3 mb-4">
        <Server className="w-6 h-6 text-blue-500" />
        <h3 className="text-lg font-semibold">Signaling Server</h3>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <span className="text-2xl">{platformInfo.icon}</span>
          <span>Detected Platform: <strong>{platformInfo.displayName}</strong></span>
        </div>
        <p className="text-sm text-gray-500">
          Self-contained binary (~{platformInfo.size})
        </p>
      </div>

      {downloading && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {progress.toFixed(0)}% downloaded
          </p>
        </div>
      )}

      <Button
        onClick={handleDownload}
        disabled={downloading}
        className="w-full"
      >
        {downloading ? (
          <>Downloading...</>
        ) : progress === 100 ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Downloaded!
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Download Server for {platformInfo.displayName}
          </>
        )}
      </Button>

      <div className="mt-4 text-xs text-gray-500">
        <p>After download:</p>
        <code className="block bg-gray-100 p-2 rounded mt-1">
          {platformInfo.platform.includes('win')
            ? 'signaling-server.exe'
            : './signaling-server'}
        </code>
        <p className="mt-2">
          The server will run on port 8080 (or PORT env variable)
        </p>
      </div>
    </Card>
  );
};