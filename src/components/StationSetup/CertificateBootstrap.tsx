import React, { useState, useEffect } from 'react';
import { Key, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';

interface CertificateBootstrapProps {
  serverUrl?: string;
  onComplete?: () => void;
}

export const CertificateBootstrap: React.FC<CertificateBootstrapProps> = ({
  serverUrl = 'http://localhost:8080',
  onComplete
}) => {
  const [status, setStatus] = useState<'checking' | 'needed' | 'ready' | 'error'>('checking');
  const [certificate, setCertificate] = useState<string>('');
  const [callsign, setCallsign] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkBootstrapStatus();
  }, [serverUrl]);

  const checkBootstrapStatus = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/certificates/status`);
      const data = await response.json();
      
      if (data.bootstrapNeeded) {
        setStatus('needed');
      } else {
        setStatus('ready');
      }
    } catch (err) {
      setStatus('error');
      setError('Unable to connect to server');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCertificate(content);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${serverUrl}/api/certificates/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          certificatePem: certificate,
          callsign: callsign.toUpperCase(),
          description: description || 'Root certificate for emergency operations',
          emergencyUse: true
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Bootstrap failed');
      }

      const result = await response.json();
      setStatus('ready');
      
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bootstrap failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'checking') {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="ml-3 text-gray-600">Checking certificate status...</span>
        </div>
      </Card>
    );
  }

  if (status === 'ready') {
    return (
      <Card className="p-6">
        <div className="flex items-start space-x-4">
          <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Certificate System Ready</h3>
            <p className="text-sm text-gray-600">
              The server has been bootstrapped with a root certificate and is ready
              for secure mesh networking operations.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (status === 'error' && !error?.includes('bootstrap')) {
    return (
      <Card className="p-6">
        <div className="flex items-start space-x-4">
          <AlertCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Connection Error</h3>
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={checkBootstrapStatus}
              className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start space-x-4">
        <Key className="h-8 w-8 text-blue-500 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">Certificate Bootstrap Required</h3>
          <p className="text-sm text-gray-600 mb-4">
            This is a fresh server deployment. Please provide a root certificate
            to establish the trust chain for secure mesh networking.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Callsign
              </label>
              <input
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="KA1ABC"
                required
                pattern="[A-Za-z0-9]+"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certificate File (.pem)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  accept=".pem,.crt,.cer"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="cert-upload"
                />
                <label
                  htmlFor="cert-upload"
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Certificate
                </label>
                {certificate && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Root certificate for network operations"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={!callsign || !certificate || submitting}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Bootstrapping...' : 'Bootstrap Certificate'}
              </button>
            </div>
          </form>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> The first certificate establishes the root of trust.
              All subsequent certificates must be signed by this root or its delegates.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};