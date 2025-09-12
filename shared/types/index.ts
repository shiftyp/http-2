// Shared TypeScript interfaces for HTTP over Ham Radio

// ============= Core Entities =============

export interface RadioStation {
  callsign: string;
  operatorName: string;
  gridSquare: string;
  radioModel: string;
  catInterface: CatInterface;
  audioInterface: AudioInterface;
  connectionStatus: ConnectionStatus;
  lastSeen: Date;
  certificate?: string;
}

export interface CatInterface {
  port: string;
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
}

export interface AudioInterface {
  inputDevice: string;
  outputDevice: string;
  pttMethod: 'CAT' | 'RTS' | 'DTR' | 'VOX';
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface Resource {
  url: string;
  callsign: string;
  path: string;
  contentType: string;
  content: string;
  headers: ResourceHeaders;
  checksum: string;
  size: number;
  compressed: boolean;
  retentionPolicy: string;
}

export interface ResourceHeaders {
  'Last-Modified': string;
  'ETag': string;
  'Cache-Control': string;
  'Content-Encoding'?: string;
}

export interface HttpRequest {
  id: string;
  method: HttpMethod;
  url: string;
  headers: RequestHeaders;
  body?: string;
  bodyETag?: string;
  sourceCallsign: string;
  priority: number;
  timeout: number;
  created: Date;
  maxHops: number;
  idempotencyKey?: string;
}

export interface RequestHeaders {
  Host: string;
  'User-Agent': string;
  Accept: string;
  'Content-Type'?: string;
  'If-None-Match'?: string;
  'If-Match'?: string;
  'X-Request-ID'?: string;
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE'
}

export interface HttpResponse {
  id: string;
  requestId: string;
  statusCode: number;
  statusText: string;
  headers: ResponseHeaders;
  body: string;
  compressed: boolean;
  size: number;
}

export interface ResponseHeaders {
  'Content-Type': string;
  'Content-Length': number;
  'Last-Modified': string;
  'ETag': string;
  'Cache-Control': string;
}

export interface Transmission {
  id: string;
  requestId?: string;
  responseId?: string;
  sourceCallsign: string;
  destinationCallsign: string;
  frequency: number;
  mode: string;
  startTime: Date;
  endTime?: Date;
  status: TransmissionStatus;
  retryCount: number;
  errorRate: number;
  acknowledgment: boolean;
  fragments?: Fragment[];
}

export enum TransmissionStatus {
  PENDING = 'pending',
  TRANSMITTING = 'transmitting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export interface Fragment {
  sequenceNumber: number;
  totalFragments: number;
  checksum: string;
}

export interface BandwidthPolicy {
  id: string;
  name: string;
  maxResourceSize: number;
  maxRequestSize: number;
  allowedContentTypes: string[];
  compressionRequired: boolean;
  stripWhitespace: boolean;
  inlineOnly: boolean;
  jsPolicy: JavaScriptPolicy;
  maxInlineScriptSize: number;
  cssPolicy: CssPolicy;
  imagePolicy: ImagePolicy;
}

export enum JavaScriptPolicy {
  NONE = 'none',
  INLINE_ONLY = 'inline-only',
  CRITICAL_ONLY = 'critical-only'
}

export enum CssPolicy {
  NONE = 'none',
  INLINE_ONLY = 'inline-only',
  CRITICAL_ONLY = 'critical-only'
}

export enum ImagePolicy {
  NONE = 'none',
  DATA_URI_ONLY = 'data-uri-only',
  ASCII_ART = 'ascii-art'
}

export interface MeshNode {
  callsign: string;
  publicKey: string;
  lastHeard: Date;
  linkQuality: number;
  hopCount: number;
  nextHop?: string;
  routingTable: Route[];
  capabilities: NodeCapabilities;
  documentCatalog: DocumentMetadata[];
}

export interface Route {
  destination: string;
  metric: number;
  updated: Date;
}

export interface NodeCapabilities {
  maxBandwidth: number;
  supportedModes: string[];
  meshVersion: string;
}

export interface DocumentMetadata {
  documentId: string;
  size: number;
  modified: Date;
  checksum: string;
}

export interface SigningListEntry {
  callsign: string;
  operatorName: string;
  country: string;
  state: string;
  city: string;
  publicKey: string;
  signature: string;
  addedDate: Date;
  lastVerified: Date;
  trustLevel: number;
  endorsements: string[];
  revoked: boolean;
  revokedDate?: Date;
  revokedReason?: string;
  trustStatus: 'pending' | 'locally_trusted' | 'fully_trusted';
}

export interface RegistrationQueueEntry {
  queueId: number;
  position: number;
  callsign: string;
  operatorName: string;
  email: string;
  country: string;
  state?: string;
  city?: string;
  publicKey: string;
  
  // Queue management
  submittedDate: Date;
  status: 'PENDING' | 'CLAIMED' | 'VERIFYING' | 'HOLD' | 'APPROVED' | 'REJECTED';
  claimedBy?: string; // Coordinator callsign
  claimedDate?: Date;
  
  // Verification
  verificationMethod?: 'document' | 'video' | 'in_person';
  verificationNotes?: string;
  fccVerified: boolean;
  identityVerified: boolean;
  
  // Decision
  decision?: 'APPROVED' | 'REJECTED' | 'HOLD';
  decisionDate?: Date;
  decisionBy?: string;
  rejectionReason?: string;
  
  // Tracking
  reminderSent: boolean;
  lastUpdated: Date;
}

export interface Endorsement {
  endorserCallsign: string;
  targetCallsign: string;
  signature: string;
  endorsementDate: Date;
  verificationMethod: 'in_person' | 'video' | 'document' | 'known';
  notes?: string;
}

export interface VerificationProof {
  method: 'in_person' | 'video' | 'document' | 'self_declaration';
  verifierCallsign: string;
  verificationDate: Date;
  proofData?: string; // Could be photo hash, document hash, etc.
  notes: string;
}

export interface Coordinator {
  callsign: string;
  name: string;
  email: string;
  region: string; // e.g., "US-Northeast"
  coordinatorLevel: 'REGIONAL' | 'ASSISTANT';
  maxDailyVerifications: number;
  verificationsToday: number;
  lastVerificationDate?: Date;
  active: boolean;
  appointedDate: Date;
}

export interface VerificationHistory {
  id: number;
  queueId: number;
  coordinatorCallsign: string;
  action: 'CLAIMED' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'RELEASED' | 'HOLD';
  notes?: string;
  timestamp: Date;
}

export interface RegionalAssignment {
  country: string;
  state?: string;
  coordinatorCallsign: string;
  isPrimary: boolean;
}

export interface RegistrationBatch {
  batchId: string;
  createdDate: Date;
  approvedEntries: RegistrationQueueEntry[];
  batchSignature: string;
  publishedInVersion?: string;
  publishedDate?: Date;
}

export interface SigningListMetadata {
  id: string;
  version: string;
  publishDate: Date;
  checksum: string;
  entryCount: number;
  signature: string;
  publisher: string;
  sourceUrl: string;
  importDate: Date;
  verificationStatus: 'verified' | 'unverified' | 'invalid';
  nextUpdateExpected: Date;
  backupPath: string;
}

export interface SigningListImport {
  // Used when importing a new signing list via secure channel
  listData: SigningListEntry[];
  metadata: SigningListMetadata;
  importMethod: 'file' | 'usb' | 'https' | 'manual';
  verificationKey: string; // Public key of trusted publisher
}

export interface TransmissionLog {
  id: string;
  timestamp: Date;
  callsign: string;
  frequency: number;
  mode: string;
  power: number;
  direction: 'transmit' | 'receive';
  remoteCallsign: string;
  duration: number;
  content: string;
}

// ============= API Request/Response Types =============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface RadioConnectRequest {
  port: string;
  baudRate: number;
  model: string;
  audioInput?: string;
  audioOutput?: string;
  pttMethod?: 'CAT' | 'RTS' | 'DTR' | 'VOX';
}

export interface RadioStatus {
  connected: boolean;
  callsign?: string;
  model?: string;
  frequency?: number;
  mode?: string;
  signalStrength?: number;
  connectionStatus: ConnectionStatus;
}

export interface DocumentCreateRequest {
  filePath: string;
  content: string;
  retentionPolicy?: string;
}

export interface DocumentSummary {
  id: string;
  callsign: string;
  filePath: string;
  title?: string;
  size: number;
  modified: Date;
}

export interface TransmitRequest {
  documentId: string;
  destination: string;
  frequency?: number;
}

export interface MeshRequestPayload {
  documentId: string;
  source?: string;
}

export interface RegistrationSubmitRequest {
  callsign: string;
  operatorName: string;
  email: string;
  country: string;
  state?: string;
  city?: string;
  publicKey: string;
}

export interface RegistrationStatusResponse {
  position: number;
  status: string;
  estimatedDays: number;
  submittedDate: Date;
  lastUpdated: Date;
}

export interface CoordinatorClaimRequest {
  queueId: number;
  coordinatorCallsign: string;
}

export interface CoordinatorVerifyRequest {
  queueId: number;
  decision: 'APPROVED' | 'REJECTED' | 'HOLD';
  verificationMethod: 'document' | 'video' | 'in_person';
  fccVerified: boolean;
  identityVerified: boolean;
  notes: string;
  rejectionReason?: string;
}

export interface QueueListRequest {
  region?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface QueueListResponse {
  entries: RegistrationQueueEntry[];
  totalCount: number;
  pendingCount: number;
  averageWaitDays: number;
}

export interface SigningListQueryRequest {
  callsign?: string;
  country?: string;
  minTrustLevel?: number;
  includeLocal?: boolean; // Include locally registered stations
}

// ============= Configuration Types =============

export interface AppConfig {
  // Offline-first configuration
  offline: {
    enabled: boolean;
    dataPath: string;
    cachePath: string;
    signingListPath: string;
  };
  station: {
    callsign: string;
    gridSquare: string;
    operatorName: string;
  };
  server: {
    port: number;
    host: string;
    serveOnly: boolean; // Server only serves frontend + signing list
  };
  radio: {
    mockMode: boolean;
    defaultFrequency: number;
    defaultMode: string;
    port: string;
    baudRate: number;
  };
  mesh: {
    enabled: boolean;
    maxHops: number;
    routeTimeout: number;
    discoveryInterval: number;
    beaconInterval: number;
  };
  bandwidth: {
    defaultPolicy: string;
    maxTransmissionSize: number;
    compressionRequired: boolean;
  };
  signing: {
    trustThreshold: number;
    minEndorsements: number;
    syncInterval: number;
    verifySignatures: boolean;
  };
}

// ============= Event Types =============

export interface RadioEvent {
  type: 'connected' | 'disconnected' | 'error' | 'frequency_changed' | 'mode_changed';
  timestamp: Date;
  data?: any;
}

export interface MeshEvent {
  type: 'node_joined' | 'node_left' | 'route_discovered' | 'request_received';
  timestamp: Date;
  callsign: string;
  data?: any;
}

export interface TransmissionEvent {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'retry';
  transmissionId: string;
  timestamp: Date;
  progress?: number;
  error?: string;
}

// ============= Utility Types =============

export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};