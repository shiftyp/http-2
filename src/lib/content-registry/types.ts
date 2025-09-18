/**
 * T023: Shared TypeScript types for content registry
 */

export enum PriorityTier {
  P0_Emergency = 0,
  P1_Infrastructure = 1,
  P2_Logistics = 2,
  P3_Community = 3,
  P4_Operational = 4,
  P5_Routine = 5
}

export interface PathRecord {
  path: string[];               // Ordered callsigns
  lastHeard: Date;              // When path was confirmed
  hopCount: number;             // Number of hops
  signalQuality: number;        // 0.0-1.0
  qualityScore?: number;        // Calculated score
}

export interface ConsolidatedBeacon {
  // Primary key
  contentHash: string;

  // Content metadata
  callsign: string;
  url?: string;
  size: number;
  mimeType: string;
  chunks?: number[];

  // Priority and retention
  priorityTier: PriorityTier;
  createdAt: Date;
  expiresAt: Date;
  lastHeard: Date;

  // Access paths
  paths: PathRecord[];

  // Availability modes
  hasWebRTC: boolean;
  hasRFChunks: boolean;

  // Metadata
  metadata?: {
    keywords?: string[];
    votes?: PriorityVote[];
    conflicts?: ConflictRecord[];
  };
}

export interface PriorityVote {
  callsign: string;
  priorityTier: PriorityTier;
  timestamp: Date;
  weight: number;
}

export interface ConflictRecord {
  field: string;
  existing: any;
  reported: any;
  station: string;
  timestamp: Date;
}

export interface BeaconUpdate {
  callsign: string;
  signature: string;
  contentHash: string;
  path: string[];
  metadata?: {
    url?: string;
    size?: number;
    mimeType?: string;
    chunks?: number[];
    priority?: PriorityTier;
  };
  signalQuality?: number;
  timestamp: Date;
}

export interface StationTrust {
  callsign: string;
  trustScore: number;
  beaconCount: number;
  verifiedCount: number;
  conflictCount: number;
  maxEntries: number;
  isVerified: boolean;
  canSetEmergency: boolean;
  firstSeen?: Date;
  lastActive?: Date;
}

export interface ContentSearchFilters {
  hash?: string;
  callsign?: string;
  priority?: number;
}

export interface AnnounceResponse {
  success: boolean;
  contentHash: string;
  consolidated: boolean;
  pathCount: number;
}

export interface BatchQueryRequest {
  hashes: string[];
}

export interface BatchQueryResponse {
  [contentHash: string]: ConsolidatedBeacon | null;
}