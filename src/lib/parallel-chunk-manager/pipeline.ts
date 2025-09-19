/**
 * Chunk Pipeline Queue for OFDM Transmission
 *
 * Manages pipelining of chunks for continuous transmission
 * with prefetching and buffering strategies.
 */

export interface PipelineChunk {
  id: string;
  data: Uint8Array;
  priority: number;
  enqueuedAt: number;
  estimatedTransmitTime: number;
  dependencies?: string[]; // Other chunks that should be sent first
}

export interface PipelineMetrics {
  depth: number;
  throughput: number; // chunks/second
  latency: number; // ms
  bufferUtilization: number; // 0-1
}

export class ChunkPipeline {
  private queue: PipelineChunk[] = [];
  private inFlight: Map<string, PipelineChunk> = new Map();
  private completed: Set<string> = new Set();
  private maxDepth: number;
  private prefetchThreshold: number;
  private metricsHistory: PipelineMetrics[] = [];

  constructor(maxDepth: number = 96) {
    this.maxDepth = maxDepth;
    this.prefetchThreshold = maxDepth * 0.5; // Prefetch when 50% empty
  }

  /**
   * Enqueue chunk for transmission
   */
  enqueue(chunk: PipelineChunk): boolean {
    // Check if already in pipeline
    if (this.isInPipeline(chunk.id)) {
      return false;
    }

    // Check dependencies
    if (chunk.dependencies) {
      const unmetDeps = chunk.dependencies.filter(dep => !this.completed.has(dep));
      if (unmetDeps.length > 0) {
        // Queue with adjusted priority
        chunk.priority *= 0.5; // Lower priority for dependent chunks
      }
    }

    // Add to queue maintaining priority order
    this.insertByPriority(chunk);

    // Trim queue if over max depth
    if (this.queue.length > this.maxDepth) {
      this.queue = this.queue.slice(0, this.maxDepth);
    }

    return true;
  }

  /**
   * Enqueue multiple chunks efficiently
   */
  enqueueBatch(chunks: PipelineChunk[]): number {
    let enqueued = 0;

    // Sort by priority first
    const sorted = chunks.sort((a, b) => b.priority - a.priority);

    for (const chunk of sorted) {
      if (this.queue.length >= this.maxDepth) break;
      if (this.enqueue(chunk)) {
        enqueued++;
      }
    }

    return enqueued;
  }

  /**
   * Dequeue next chunk for transmission
   */
  dequeue(): PipelineChunk | null {
    // Find next chunk with met dependencies
    for (let i = 0; i < this.queue.length; i++) {
      const chunk = this.queue[i];

      if (this.areDependenciesMet(chunk)) {
        this.queue.splice(i, 1);
        this.inFlight.set(chunk.id, chunk);
        return chunk;
      }
    }

    return null;
  }

  /**
   * Dequeue multiple chunks for parallel transmission
   */
  dequeueBatch(count: number): PipelineChunk[] {
    const chunks: PipelineChunk[] = [];

    for (let i = 0; i < count; i++) {
      const chunk = this.dequeue();
      if (chunk) {
        chunks.push(chunk);
      } else {
        break;
      }
    }

    return chunks;
  }

  /**
   * Mark chunk as completed
   */
  markCompleted(chunkId: string): void {
    if (this.inFlight.has(chunkId)) {
      const chunk = this.inFlight.get(chunkId)!;
      this.inFlight.delete(chunkId);
      this.completed.add(chunkId);

      // Update metrics
      const latency = Date.now() - chunk.enqueuedAt;
      this.updateMetrics(latency);
    }
  }

  /**
   * Mark chunk as failed and requeue
   */
  markFailed(chunkId: string, retry: boolean = true): void {
    if (this.inFlight.has(chunkId)) {
      const chunk = this.inFlight.get(chunkId)!;
      this.inFlight.delete(chunkId);

      if (retry) {
        // Requeue with reduced priority
        chunk.priority *= 0.8;
        chunk.enqueuedAt = Date.now();
        this.enqueue(chunk);
      }
    }
  }

  /**
   * Check if dependencies are met
   */
  private areDependenciesMet(chunk: PipelineChunk): boolean {
    if (!chunk.dependencies || chunk.dependencies.length === 0) {
      return true;
    }

    return chunk.dependencies.every(dep => this.completed.has(dep));
  }

  /**
   * Insert chunk maintaining priority order
   */
  private insertByPriority(chunk: PipelineChunk): void {
    // Binary search for insertion point
    let left = 0;
    let right = this.queue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.queue[mid].priority > chunk.priority) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    this.queue.splice(left, 0, chunk);
  }

  /**
   * Check if chunk is in pipeline
   */
  private isInPipeline(chunkId: string): boolean {
    return this.queue.some(c => c.id === chunkId) ||
           this.inFlight.has(chunkId) ||
           this.completed.has(chunkId);
  }

  /**
   * Check if prefetch is needed
   */
  needsPrefetch(): boolean {
    return this.queue.length < this.prefetchThreshold;
  }

  /**
   * Get pipeline fill level
   */
  getFillLevel(): number {
    return this.queue.length / this.maxDepth;
  }

  /**
   * Get chunks ready for transmission
   */
  getReadyChunks(limit: number = 48): PipelineChunk[] {
    const ready: PipelineChunk[] = [];

    for (const chunk of this.queue) {
      if (ready.length >= limit) break;

      if (this.areDependenciesMet(chunk)) {
        ready.push(chunk);
      }
    }

    return ready;
  }

  /**
   * Update pipeline metrics
   */
  private updateMetrics(latency: number): void {
    const now = Date.now();
    const recentCompletions = this.metricsHistory.filter(m =>
      now - m.latency < 1000
    ).length;

    const metric: PipelineMetrics = {
      depth: this.queue.length,
      throughput: recentCompletions,
      latency,
      bufferUtilization: this.queue.length / this.maxDepth
    };

    this.metricsHistory.push(metric);

    // Keep last 100 metrics
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    if (this.metricsHistory.length === 0) {
      return {
        depth: this.queue.length,
        throughput: 0,
        latency: 0,
        bufferUtilization: this.queue.length / this.maxDepth
      };
    }

    // Calculate averages
    const recent = this.metricsHistory.slice(-10);
    const avgLatency = recent.reduce((sum, m) => sum + m.latency, 0) / recent.length;
    const avgThroughput = recent.reduce((sum, m) => sum + m.throughput, 0) / recent.length;

    return {
      depth: this.queue.length,
      throughput: avgThroughput,
      latency: avgLatency,
      bufferUtilization: this.queue.length / this.maxDepth
    };
  }

  /**
   * Get pipeline status
   */
  getStatus(): {
    queued: number;
    inFlight: number;
    completed: number;
    fillLevel: number;
    needsPrefetch: boolean;
  } {
    return {
      queued: this.queue.length,
      inFlight: this.inFlight.size,
      completed: this.completed.size,
      fillLevel: this.getFillLevel(),
      needsPrefetch: this.needsPrefetch()
    };
  }

  /**
   * Optimize pipeline ordering based on metrics
   */
  optimize(): void {
    // Re-sort queue based on updated priorities and dependencies
    this.queue.sort((a, b) => {
      // Prioritize chunks with met dependencies
      const aDepsM = this.areDependenciesMet(a);
      const bDepsM = this.areDependenciesMet(b);

      if (aDepsM && !bDepsM) return -1;
      if (!aDepsM && bDepsM) return 1;

      // Then by priority
      return b.priority - a.priority;
    });
  }

  /**
   * Clear pipeline
   */
  clear(): void {
    this.queue = [];
    this.inFlight.clear();
    this.completed.clear();
    this.metricsHistory = [];
  }

  /**
   * Get estimated time to transmit all queued chunks
   */
  getEstimatedCompletionTime(): number {
    const totalChunks = this.queue.length + this.inFlight.size;
    const metrics = this.getMetrics();

    if (metrics.throughput === 0) {
      // Estimate based on chunk transmission times
      const avgTransmitTime = this.queue.reduce((sum, c) =>
        sum + c.estimatedTransmitTime, 0
      ) / Math.max(1, this.queue.length);

      return totalChunks * avgTransmitTime;
    }

    return (totalChunks / metrics.throughput) * 1000; // Convert to ms
  }
}

export { ChunkPipeline as default };