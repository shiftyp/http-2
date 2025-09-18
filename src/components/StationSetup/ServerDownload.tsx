import React, { useState } from 'react';
import { Download, Server, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card } from '../ui/Card';

interface ServerDownloadProps {
  onComplete?: () => void;
}

export const ServerDownload: React.FC<ServerDownloadProps> = ({ onComplete }) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    setProgress(0);

    try {
      const response = await fetch('/api/packages/download', {
        method: 'GET',
        headers: {
          'Accept': 'application/zip'
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength || '0', 10);
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response');
      }

      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (total > 0) {
          setProgress(Math.round((loaded / total) * 100));
        }
      }

      // Create blob and trigger download
      const blob = new Blob(chunks, { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ham-radio-server.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setCompleted(true);
      setDownloading(false);

      // Save configuration
      localStorage.setItem('serverDownloaded', 'true');
      localStorage.setItem('serverDownloadDate', new Date().toISOString());

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      setDownloading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleDownload();
  };

  return (
    <Card className="p-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <Server className="h-12 w-12 text-blue-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">Emergency Server Deployment</h3>
          
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Emergency Preparedness</p>
                <p>
                  Licensed stations are encouraged to download and maintain
                  their own server for emergency preparedness, ensuring
                  network resilience when internet infrastructure is unavailable.
                </p>
              </div>
            </div>
          </div>

          {!completed && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Download the complete server package including all platform
                binaries and PWA files. The package is approximately 50 MB.
              </p>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Multi-platform support (Linux, macOS, Windows)</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Integrated PWA for offline operation</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Certificate bootstrapping for secure mesh</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>WebRTC signaling for peer-to-peer connections</span>
                </div>
              </div>
            </>
          )}

          {downloading && (
            <div className="mb-4" data-testid="download-progress">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Downloading...</span>
                <span className="text-sm text-gray-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="download-error">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {completed && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg" data-testid="download-complete">
              <p className="text-sm text-green-700">
                <CheckCircle className="inline h-4 w-4 mr-1" />
                Download complete! The server package has been saved to your downloads folder.
              </p>
            </div>
          )}

          <div className="flex space-x-3">
            {!completed && !downloading && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="download-button"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Server Package
              </button>
            )}

            {error && (
              <button
                onClick={handleRetry}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Retry Download
              </button>
            )}

            {completed && (
              <div className="text-sm text-gray-600" data-testid="server-status">
                <CheckCircle className="inline h-4 w-4 text-green-500 mr-1" />
                Server package ready for deployment
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};