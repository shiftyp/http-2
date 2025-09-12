import React, { useEffect, useState } from 'react';
import './InstallPrompt.css';

interface InstallPromptProps {
  onClose: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
    onClose();
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    onClose();
  };

  if (!showPrompt) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <h3>Install Ham Radio HTTP</h3>
        <p>Install this app for offline access and better performance.</p>
        <div className="install-prompt-features">
          <ul>
            <li>✓ Works offline</li>
            <li>✓ Direct radio control</li>
            <li>✓ Local data storage</li>
            <li>✓ No internet required</li>
          </ul>
        </div>
        <div className="install-prompt-actions">
          <button onClick={handleInstall} className="install-button">
            Install App
          </button>
          <button onClick={handleDismiss} className="dismiss-button secondary">
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;