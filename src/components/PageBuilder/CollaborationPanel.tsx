/**
 * Collaboration Panel
 *
 * Real-time collaboration interface for the Visual Page Builder
 * showing connected users, live cursors, and collaborative editing state.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { PageComponent } from '../../pages/PageBuilder';

export interface CollaborationUser {
  id: string;
  callsign: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    componentId?: string;
  };
  isActive: boolean;
  lastSeen: Date;
  permissions: 'read' | 'edit' | 'admin';
}

export interface CollaborationState {
  sessionId: string;
  users: CollaborationUser[];
  isConnected: boolean;
  conflicts: Array<{
    componentId: string;
    users: string[];
    timestamp: Date;
  }>;
}

interface CollaborationPanelProps {
  collaborationState: CollaborationState;
  currentUser: CollaborationUser;
  onUserInvite: (callsign: string) => void;
  onPermissionChange: (userId: string, permission: CollaborationUser['permissions']) => void;
  onKickUser: (userId: string) => void;
  onResolveConflict: (componentId: string, resolution: 'merge' | 'mine' | 'theirs') => void;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  collaborationState,
  currentUser,
  onUserInvite,
  onPermissionChange,
  onKickUser,
  onResolveConflict
}) => {
  const [inviteCallsign, setInviteCallsign] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);

  const activeUsers = collaborationState.users.filter(user => user.isActive);
  const hasConflicts = collaborationState.conflicts.length > 0;

  const handleInvite = () => {
    if (inviteCallsign.trim()) {
      onUserInvite(inviteCallsign.toUpperCase());
      setInviteCallsign('');
      setShowInviteForm(false);
    }
  };

  const getPermissionColor = (permission: CollaborationUser['permissions']) => {
    switch (permission) {
      case 'admin': return 'bg-red-600';
      case 'edit': return 'bg-blue-600';
      case 'read': return 'bg-gray-600';
      default: return 'bg-gray-600';
    }
  };

  const getLastSeenText = (lastSeen: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Collaboration</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              collaborationState.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-xs text-gray-400">
              {collaborationState.isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Status */}
        {!collaborationState.isConnected && (
          <div className="p-3 bg-yellow-900 bg-opacity-50 rounded border border-yellow-600">
            <p className="text-sm text-yellow-200">
              ⚠️ Collaboration disconnected. Changes are being saved locally.
            </p>
          </div>
        )}

        {/* Conflicts Alert */}
        {hasConflicts && (
          <div className="p-3 bg-red-900 bg-opacity-50 rounded border border-red-600">
            <p className="text-sm text-red-200 mb-2">
              🔄 {collaborationState.conflicts.length} editing conflict(s) detected
            </p>
            {collaborationState.conflicts.map((conflict) => (
              <div key={conflict.componentId} className="mt-2">
                <p className="text-xs text-red-300">
                  Component conflict with {conflict.users.join(', ')}
                </p>
                <div className="flex space-x-1 mt-1">
                  <Button
                    size="sm"
                    onClick={() => onResolveConflict(conflict.componentId, 'mine')}
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    Keep Mine
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onResolveConflict(conflict.componentId, 'theirs')}
                    className="text-xs bg-green-600 hover:bg-green-700"
                  >
                    Accept Theirs
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onResolveConflict(conflict.componentId, 'merge')}
                    className="text-xs bg-purple-600 hover:bg-purple-700"
                  >
                    Merge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Users */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">
              Active Users ({activeUsers.length})
            </h4>
            {currentUser.permissions === 'admin' && (
              <Button
                size="sm"
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="text-xs bg-gray-600 hover:bg-gray-700"
              >
                + Invite
              </Button>
            )}
          </div>

          {/* Invite Form */}
          {showInviteForm && (
            <div className="mb-3 p-2 bg-gray-800 rounded">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inviteCallsign}
                  onChange={(e) => setInviteCallsign(e.target.value)}
                  placeholder="Enter callsign"
                  className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded"
                  maxLength={6}
                />
                <Button
                  size="sm"
                  onClick={handleInvite}
                  disabled={!inviteCallsign.trim()}
                  className="text-xs"
                >
                  Invite
                </Button>
              </div>
            </div>
          )}

          {/* User List */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {collaborationState.users.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between p-2 rounded ${
                  user.id === currentUser.id ? 'bg-blue-900 bg-opacity-30' : 'bg-gray-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full`}
                    style={{ backgroundColor: user.color }}
                  />
                  <div>
                    <div className="text-sm font-medium">
                      {user.callsign}
                      {user.id === currentUser.id && (
                        <span className="text-xs text-gray-400 ml-1">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {user.isActive ? 'Active' : getLastSeenText(user.lastSeen)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${getPermissionColor(user.permissions)}`}
                  >
                    {user.permissions}
                  </Badge>

                  {currentUser.permissions === 'admin' && user.id !== currentUser.id && (
                    <div className="flex space-x-1">
                      <select
                        value={user.permissions}
                        onChange={(e) => onPermissionChange(user.id, e.target.value as any)}
                        className="text-xs bg-gray-700 border border-gray-600 rounded px-1 py-0.5"
                      >
                        <option value="read">Read</option>
                        <option value="edit">Edit</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Button
                        size="sm"
                        onClick={() => onKickUser(user.id)}
                        className="text-xs bg-red-600 hover:bg-red-700 px-1 py-0.5"
                        title="Remove user"
                      >
                        ×
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session Info */}
        <div className="pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400">
            <div>Session: {collaborationState.sessionId.substring(0, 8)}...</div>
            <div>
              Bandwidth: {collaborationState.isConnected ? 'WebRTC' : 'RF fallback'}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-2">
          <Button
            size="sm"
            className="flex-1 text-xs bg-gray-600 hover:bg-gray-700"
            onClick={() => {/* Copy session link */}}
          >
            📋 Copy Link
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs bg-gray-600 hover:bg-gray-700"
            onClick={() => {/* Export session */}}
          >
            📁 Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CollaborationPanel;