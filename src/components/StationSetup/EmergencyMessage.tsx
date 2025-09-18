import React from 'react';
import { AlertTriangle, Radio, Shield, Wifi } from 'lucide-react';

export const EmergencyMessage: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-300 rounded-lg p-6 mb-6">
      <div className="flex items-center mb-4">
        <AlertTriangle className="h-6 w-6 text-orange-600 mr-2" />
        <h2 className="text-xl font-bold text-gray-800">Emergency Preparedness</h2>
      </div>
      
      <p className="text-gray-700 mb-4">
        As a licensed amateur radio operator, you play a vital role in emergency communications.
        Maintaining your own signaling server ensures network resilience when traditional
        internet infrastructure becomes unavailable.
      </p>
      
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="flex items-start">
          <Radio className="h-5 w-5 text-blue-600 mt-1 mr-2 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-sm mb-1">Local Operations</h3>
            <p className="text-sm text-gray-600">
              Server runs completely offline for mesh networking
            </p>
          </div>
        </div>
        
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-green-600 mt-1 mr-2 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-sm mb-1">Secure Network</h3>
            <p className="text-sm text-gray-600">
              Certificate-based authentication for trusted stations
            </p>
          </div>
        </div>
        
        <div className="flex items-start">
          <Wifi className="h-5 w-5 text-purple-600 mt-1 mr-2 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-sm mb-1">Distributed Mesh</h3>
            <p className="text-sm text-gray-600">
              Multiple servers create resilient network topology
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-white bg-opacity-50 rounded border border-yellow-200">
        <p className="text-xs text-gray-600">
          <strong>Remember:</strong> During emergencies, amateur radio may be the only
          reliable communication method. Your preparedness can make a difference in
          your community's ability to coordinate response efforts.
        </p>
      </div>
    </div>
  );
};