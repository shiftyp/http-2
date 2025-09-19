/**
 * OFDM Chunk Allocation Matrix Display
 *
 * Visual matrix showing chunk-to-carrier allocations with
 * status, priority, and progress indicators.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ParallelChunkManager } from '../../lib/parallel-chunk-manager/index.js';
import type { SubcarrierAllocation } from '../../lib/parallel-chunk-manager/index.js';

export interface AllocationMatrixProps {
  chunkManager: ParallelChunkManager;
  updateInterval?: number;
  showLabels?: boolean;
  compactView?: boolean;
  maxChunksDisplay?: number;
}

interface ChunkInfo {
  id: string;
  carrierId: number | null;
  status: 'pending' | 'transmitting' | 'completed' | 'failed';
  progress: number; // 0-100
  priority: number; // 0-1
  attempts: number;
  estimatedTime?: number;
}

interface CarrierInfo {
  id: number;
  isPilot: boolean;
  allocated: boolean;
  chunkId: string | null;
  quality: number; // 0-1
}

export const AllocationMatrix: React.FC<AllocationMatrixProps> = ({
  chunkManager,
  updateInterval = 250,
  showLabels = true,
  compactView = false,
  maxChunksDisplay = 100
}) => {
  const [allocations, setAllocations] = useState<Map<number, SubcarrierAllocation>>(new Map());
  const [chunkStatus, setChunkStatus] = useState<Map<string, ChunkInfo>>(new Map());
  const [carriers, setCarriers] = useState<CarrierInfo[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    failed: 0,
    queued: 0,
    throughput: 0
  });

  // Pilot carrier positions
  const pilotCarriers = [0, 6, 12, 18, 24, 30, 36, 42];

  /**
   * Initialize carrier info
   */
  useEffect(() => {
    const carrierList: CarrierInfo[] = [];
    for (let i = 0; i < 48; i++) {
      carrierList.push({
        id: i,
        isPilot: pilotCarriers.includes(i),
        allocated: false,
        chunkId: null,
        quality: Math.random() // Simulated quality
      });
    }
    setCarriers(carrierList);
  }, []);

  /**
   * Update allocations from chunk manager
   */
  useEffect(() => {
    const updateData = () => {
      // Get current allocations
      const currentAllocations = chunkManager.getCarrierAllocations();
      setAllocations(new Map(currentAllocations));

      // Get allocation status
      const status = chunkManager.getAllocationStatus();
      setStats(status);

      // Update carrier info
      setCarriers(prev => prev.map(carrier => {
        const allocation = currentAllocations.get(carrier.id);
        return {
          ...carrier,
          allocated: !!allocation,
          chunkId: allocation?.chunkId || null
        };
      }));

      // Build chunk status map
      const chunks = new Map<string, ChunkInfo>();

      // Add allocated chunks
      for (const [carrierId, allocation] of currentAllocations.entries()) {
        chunks.set(allocation.chunkId, {
          id: allocation.chunkId,
          carrierId,
          status: allocation.status,
          progress: calculateProgress(allocation),
          priority: 0.5, // Would come from chunk metadata
          attempts: 1, // Would track from manager
          estimatedTime: allocation.estimatedDuration
        });
      }

      setChunkStatus(chunks);
    };

    updateData();
    const interval = setInterval(updateData, updateInterval);

    return () => clearInterval(interval);
  }, [chunkManager, updateInterval]);

  /**
   * Calculate transmission progress
   */
  const calculateProgress = (allocation: SubcarrierAllocation): number => {
    if (allocation.status === 'completed') return 100;
    if (allocation.status === 'pending') return 0;
    if (allocation.status === 'failed') return 0;

    const elapsed = Date.now() - allocation.startTime;
    const progress = Math.min(100, (elapsed / allocation.estimatedDuration) * 100);
    return Math.round(progress);
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return 'bg-gray-400';
      case 'transmitting': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  /**
   * Get priority color
   */
  const getPriorityColor = (priority: number): string => {
    if (priority > 0.8) return 'border-red-500';
    if (priority > 0.5) return 'border-yellow-500';
    return 'border-gray-300';
  };

  /**
   * Render carrier grid
   */
  const carrierGrid = useMemo(() => {
    const rows = compactView ? 6 : 8;
    const cols = compactView ? 8 : 6;

    return (
      <div className="carrier-grid grid gap-1" style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`
      }}>
        {carriers.map(carrier => {
          const allocation = allocations.get(carrier.id);
          const isActive = allocation && allocation.status === 'transmitting';

          return (
            <div
              key={carrier.id}
              className={`
                carrier-cell relative border-2 rounded p-1 cursor-pointer
                transition-all duration-200
                ${carrier.isPilot ? 'bg-yellow-100' : 'bg-white'}
                ${carrier.allocated ? 'border-blue-400' : 'border-gray-200'}
                ${isActive ? 'animate-pulse' : ''}
                ${selectedChunk === allocation?.chunkId ? 'ring-2 ring-blue-600' : ''}
              `}
              onClick={() => allocation && setSelectedChunk(
                selectedChunk === allocation.chunkId ? null : allocation.chunkId
              )}
              title={`Carrier ${carrier.id}${carrier.isPilot ? ' (Pilot)' : ''}`}
            >
              <div className="text-xs font-mono text-center">
                {carrier.id}
              </div>

              {allocation && (
                <>
                  <div className={`
                    absolute bottom-0 left-0 right-0 h-1
                    ${getStatusColor(allocation.status)}
                    opacity-75
                  `} style={{
                    width: `${calculateProgress(allocation)}%`
                  }} />

                  {!compactView && (
                    <div className="text-xs text-gray-600 truncate">
                      {allocation.chunkId.slice(0, 8)}
                    </div>
                  )}
                </>
              )}

              {carrier.isPilot && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    );
  }, [carriers, allocations, selectedChunk, compactView]);

  /**
   * Render chunk queue
   */
  const chunkQueue = useMemo(() => {
    const chunks = Array.from(chunkStatus.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxChunksDisplay);

    return (
      <div className="chunk-queue space-y-1">
        {chunks.map(chunk => (
          <div
            key={chunk.id}
            className={`
              chunk-item flex items-center gap-2 p-2 rounded
              border-2 cursor-pointer transition-all
              ${getPriorityColor(chunk.priority)}
              ${selectedChunk === chunk.id ? 'bg-blue-50' : 'bg-white'}
            `}
            onClick={() => setSelectedChunk(
              selectedChunk === chunk.id ? null : chunk.id
            )}
          >
            <div className={`
              status-indicator w-3 h-3 rounded-full
              ${getStatusColor(chunk.status)}
            `} />

            <div className="chunk-id text-sm font-mono flex-1 truncate">
              {chunk.id}
            </div>

            {chunk.carrierId !== null && (
              <div className="carrier-id text-xs text-gray-500">
                C{chunk.carrierId}
              </div>
            )}

            <div className="progress text-xs text-gray-600">
              {chunk.progress}%
            </div>

            {chunk.attempts > 1 && (
              <div className="attempts text-xs text-red-500">
                ×{chunk.attempts}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }, [chunkStatus, selectedChunk, maxChunksDisplay]);

  return (
    <div className="allocation-matrix">
      <div className="matrix-header mb-4">
        <h3 className="text-lg font-semibold mb-2">Chunk-to-Carrier Allocation</h3>

        <div className="stats-bar flex gap-4 text-sm">
          <div className="stat">
            <span className="text-gray-500">Active:</span>
            <span className="font-bold ml-1 text-blue-600">{stats.active}</span>
          </div>
          <div className="stat">
            <span className="text-gray-500">Completed:</span>
            <span className="font-bold ml-1 text-green-600">{stats.completed}</span>
          </div>
          <div className="stat">
            <span className="text-gray-500">Failed:</span>
            <span className="font-bold ml-1 text-red-600">{stats.failed}</span>
          </div>
          <div className="stat">
            <span className="text-gray-500">Queued:</span>
            <span className="font-bold ml-1 text-gray-600">{stats.queued}</span>
          </div>
          <div className="stat">
            <span className="text-gray-500">Throughput:</span>
            <span className="font-bold ml-1">{stats.throughput} chunks/s</span>
          </div>
        </div>
      </div>

      <div className="matrix-content grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="carriers-section lg:col-span-2">
          <h4 className="text-sm font-medium mb-2">Carrier Status</h4>
          {carrierGrid}

          {showLabels && (
            <div className="legend mt-2 flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-100 border border-gray-300 rounded" />
                <span>Pilot</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span>Transmitting</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span>Failed</span>
              </div>
            </div>
          )}
        </div>

        <div className="chunks-section">
          <h4 className="text-sm font-medium mb-2">Chunk Queue</h4>
          <div className="max-h-96 overflow-y-auto">
            {chunkQueue}
          </div>
        </div>
      </div>

      {selectedChunk && (
        <div className="chunk-details mt-4 p-3 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Chunk Details: {selectedChunk}</h4>
          {(() => {
            const chunk = chunkStatus.get(selectedChunk);
            const allocation = Array.from(allocations.values())
              .find(a => a.chunkId === selectedChunk);

            if (!chunk) return <div>No details available</div>;

            return (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="ml-2 font-medium">{chunk.status}</span>
                </div>
                <div>
                  <span className="text-gray-500">Progress:</span>
                  <span className="ml-2 font-medium">{chunk.progress}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Carrier:</span>
                  <span className="ml-2 font-medium">
                    {chunk.carrierId !== null ? `#${chunk.carrierId}` : 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Priority:</span>
                  <span className="ml-2 font-medium">
                    {(chunk.priority * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Attempts:</span>
                  <span className="ml-2 font-medium">{chunk.attempts}</span>
                </div>
                {allocation && (
                  <div>
                    <span className="text-gray-500">Quality:</span>
                    <span className="ml-2 font-medium">
                      {(allocation.quality * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default AllocationMatrix;