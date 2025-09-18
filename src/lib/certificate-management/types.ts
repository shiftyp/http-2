/**
 * Certificate Management Types
 *
 * TypeScript interfaces for amateur radio certificate management system
 * supporting X.509 certificates with amateur radio extensions.
 *
 * @module CertificateManagement
 */

// ==================== Enums ====================

/**
 * Types of certificates supported in the amateur radio system
 */
export enum CertificateType {
  SELF_SIGNED = 'self-signed',
  ARRL = 'arrl',
  LOTW = 'lotw'
}

/**
 * Trust levels assigned to certificates
 * Higher numbers indicate higher trust
 */
export enum TrustLevel {
  UNKNOWN = 0,
  SELF_SIGNED = 1,
  ARRL = 2,
  LOTW = 3
}

/**
 * Status of a certificate request
 */
export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

/**
 * Types of CAPTCHA challenges for human verification
 */
export enum ChallengeType {
  MATH = 'math',
  HAM_KNOWLEDGE = 'ham_knowledge',
  PATTERN = 'pattern',
  GEOGRAPHY = 'geography',
  MULTIPLE_CHOICE = 'multiple_choice'
}

// ==================== Core Interfaces ====================

/**
 * X.509 certificate with amateur radio extensions for station identification
 */
export interface Certificate {
  /** Unique certificate identifier */
  id: string;

  /** Amateur radio callsign */
  callsign: string;

  /** Type of certificate */
  type: CertificateType;

  // Certificate data
  /** Raw X.509 certificate in DER format */
  x509Data: ArrayBuffer;

  /** PEM-encoded public key */
  publicKeyPem: string;

  /** PEM-encoded private key (client-side only, not transmitted) */
  privateKeyPem?: string;

  // Amateur radio extensions
  /** FCC license class */
  licenseClass: string;

  /** Maidenhead grid locator */
  gridSquare?: string;

  // Metadata
  /** Certificate issuer Distinguished Name */
  issuer: string;

  /** Certificate subject Distinguished Name */
  subject: string;

  /** Certificate serial number */
  serialNumber: string;

  // Validity
  /** Certificate valid from timestamp (ISO 8601) */
  validFrom: string;

  /** Certificate valid to timestamp (ISO 8601) */
  validTo: string;

  /** Whether certificate has been revoked */
  isRevoked: boolean;

  // Trust and approval
  /** Calculated trust level */
  trustLevel: TrustLevel;

  /** List of server callsigns that have approved this certificate */
  approvedServers: string[];

  // Timestamps
  /** When certificate was created (ISO 8601) */
  createdAt: string;

  /** When certificate was last used (ISO 8601) */
  lastUsedAt?: string;

  /** Where certificate is stored */
  storageLocation: 'indexeddb' | 'server' | 'both';
}

/**
 * Station information for certificate requests
 */
export interface StationInfo {
  /** Amateur radio callsign */
  callsign: string;

  /** FCC license class */
  licenseClass: string;

  /** Maidenhead grid locator */
  gridSquare?: string;

  /** Human-readable location description */
  location?: string;

  /** Radio equipment description */
  equipment?: string;

  /** Antenna system description */
  antenna?: string;

  /** Transmit power in watts */
  power?: number;
}

/**
 * Request for certificate approval on a server
 */
export interface CertificateRequest {
  /** Unique request identifier */
  id: string;

  /** Reference to Certificate.id */
  certificateId: string;

  // Request details
  /** Requesting station callsign */
  callsign: string;

  /** Server receiving the request */
  serverCallsign: string;

  /** Station information for review */
  stationInfo: StationInfo;

  // Certificate data (for approval review)
  /** Type of certificate being requested */
  certificateType: CertificateType;

  /** FCC license class */
  licenseClass: string;

  /** Maidenhead grid locator */
  gridSquare?: string;

  /** Public key for verification */
  publicKeyPem: string;

  // CAPTCHA verification
  /** Current CAPTCHA challenge */
  captchaChallenge?: CAPTCHAChallenge;

  /** Submitted CAPTCHA solution */
  captchaSolution?: SignedCAPTCHASolution;

  /** Whether CAPTCHA has been verified */
  captchaVerified: boolean;

  // Request status
  /** Current status of the request */
  status: RequestStatus;

  /** When request was submitted (ISO 8601) */
  submittedAt: string;

  /** When request was reviewed (ISO 8601) */
  reviewedAt?: string;

  /** Server operator callsign who reviewed */
  reviewedBy?: string;

  // Decision details
  /** Approval record if approved */
  approvalRecord?: ApprovalRecord;

  /** Reason for rejection if rejected */
  rejectionReason?: string;

  // Metadata
  /** Whether request was auto-generated or manual */
  requestSource: 'auto' | 'manual';

  /** Number of submission attempts */
  retryCount: number;

  /** When request expires (ISO 8601) */
  expiresAt: string;
}

/**
 * Radio-optimized verification challenge
 */
export interface CAPTCHAChallenge {
  /** Unique challenge identifier */
  id: string;

  /** Server that generated the challenge */
  serverCallsign: string;

  // Challenge details
  /** Type of challenge */
  type: ChallengeType;

  /** Challenge question text */
  question: string;

  /** Correct answer (server-side only) */
  expectedAnswer: string;

  /** SHA-256 hash of correct answer */
  answerHash: string;

  // Challenge options (for multiple choice)
  /** Array of possible answers for multiple choice */
  options?: string[];

  /** Index of correct answer (server-side only) */
  correctIndex?: number;

  // Metadata
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';

  /** Challenge category */
  category: string;

  // Validity
  /** When challenge was generated (ISO 8601) */
  generatedAt: string;

  /** When challenge expires (ISO 8601) */
  expiresAt: string;

  /** Server signature to prevent tampering */
  signature: string;

  // Usage tracking
  /** Callsigns that have used this challenge */
  usedBy: string[];

  /** Maximum number of uses allowed */
  maxUses: number;
}

/**
 * CAPTCHA solution signed by the originating certificate
 */
export interface SignedCAPTCHASolution {
  /** Unique solution identifier */
  id: string;

  /** Reference to CAPTCHAChallenge.id */
  challengeId: string;

  // Solution details
  /** The submitted answer */
  answer: string;

  /** SHA-256 hash of the answer */
  solutionHash: string;

  // Signing details
  /** Callsign of solver */
  solvedBy: string;

  /** Certificate used to sign the solution */
  signingCertificateId: string;

  /** Digital signature of solution */
  signature: string;

  /** When solution was created (ISO 8601) */
  solvedAt: string;

  // Verification status
  /** Whether solution is correct */
  isValid: boolean;

  /** When verification occurred (ISO 8601) */
  verifiedAt?: string;

  /** Server that verified the solution */
  verifiedBy?: string;

  /** CertificateRequest IDs that used this solution */
  usedForRequests: string[];

  /** Size in bytes when compressed for transmission */
  compressionSize: number;
}

/**
 * Server operator's decision on a certificate request
 */
export interface ApprovalRecord {
  /** Unique approval record identifier */
  id: string;

  /** Reference to CertificateRequest.id */
  requestId: string;

  // Approval details
  /** Decision made by operator */
  decision: 'approved' | 'rejected';

  /** Server operator callsign */
  approvedBy: string;

  /** When decision was made (ISO 8601) */
  approvedAt: string;

  // Trust assignment
  /** Trust level assigned to certificate */
  assignedTrustLevel: TrustLevel;

  /** Reason for trust level assignment */
  trustJustification: string;

  // Conditions and restrictions
  /** Any conditions of approval */
  conditions?: string[];

  /** Any usage restrictions */
  restrictions?: string[];

  /** Approval expiration timestamp (ISO 8601) */
  expiresAt?: string;

  // Review notes
  /** Private notes from operator */
  reviewNotes?: string;

  /** Notes visible to certificate holder */
  publicNotes?: string;

  /** Time taken to review in milliseconds */
  reviewDuration: number;

  /** Whether this is an appeal of previous rejection */
  isAppeal: boolean;
}

/**
 * Certificate ban record (distinguished from revocation)
 */
export interface BanRecord {
  /** Unique ban record identifier */
  id: string;

  /** Reference to Certificate.id */
  certificateId: string;

  /** Callsign that is banned */
  bannedCallsign: string;

  // Ban details
  /** Server callsign that issued the ban */
  banningServer: string;

  /** Operator callsign that issued the ban */
  bannedBy: string;

  /** When ban was issued (ISO 8601) */
  bannedAt: string;

  // Ban scope
  /** Scope of the ban */
  banType: 'server' | 'network';

  /** Severity level */
  severity: 'warning' | 'temporary' | 'permanent';

  /** When ban expires for temporary bans (ISO 8601) */
  expiresAt?: string;

  // Justification
  /** Reason for ban */
  reason: string;

  /** Supporting evidence */
  evidence?: string[];

  // Ban distribution
  /** Whether to broadcast ban when hearing CQ */
  broadcastEnabled: boolean;

  /** Servers that have acknowledged the ban */
  acknowledgedBy: string[];

  // Appeal process
  /** Whether appeals are accepted */
  appealAllowed: boolean;

  /** Deadline for appeals (ISO 8601) */
  appealDeadline?: string;

  // Metadata
  /** Whether ban is currently in effect */
  isActive: boolean;

  /** When ban was revoked (ISO 8601) */
  revokedAt?: string;

  /** Who revoked the ban */
  revokedBy?: string;
}

/**
 * Factor contributing to trust score calculation
 */
export interface TrustFactor {
  /** Name of trust factor */
  factor: string;

  /** Weight in trust calculation (0-1) */
  weight: number;

  /** Factor value (0-1) */
  value: number;

  /** Human-readable description */
  description: string;
}

/**
 * Certificate trust relationships and lineage
 */
export interface TrustChain {
  /** Unique trust chain identifier */
  id: string;

  /** Root certificate in the chain */
  rootCertificateId: string;

  /** End certificate in the chain */
  leafCertificateId: string;

  // Chain structure
  /** Array of certificate IDs from root to leaf */
  chainPath: string[];

  /** Number of certificates in chain */
  chainDepth: number;

  // Trust calculation
  /** Calculated trust score (0-100) */
  trustScore: number;

  /** Factors contributing to trust score */
  trustFactors: TrustFactor[];

  // Validation
  /** Whether chain is currently valid */
  isValid: boolean;

  /** When chain was last validated (ISO 8601) */
  lastValidated: string;

  /** Servers that have validated this chain */
  validatedBy: string[];

  // Consensus
  /** Number of servers agreeing on this chain */
  consensusCount: number;

  /** Required consensus for acceptance */
  consensusThreshold: number;

  // Chain metadata
  /** When trust chain was first established (ISO 8601) */
  establishedAt: string;

  /** When chain was last used for verification (ISO 8601) */
  lastUsedAt: string;

  // Expiration and refresh
  /** When chain expires without refresh (ISO 8601) */
  expiresAt: string;

  /** How often to refresh chain in seconds */
  refreshInterval: number;

  // Path quality metrics
  /** Reliability score based on intermediate nodes (0-1) */
  pathReliability: number;

  /** Average verification latency in milliseconds */
  pathLatency: number;
}

// ==================== Helper Types ====================

/**
 * Storage location options for certificates
 */
export type StorageLocation = 'indexeddb' | 'server' | 'both';

/**
 * Difficulty levels for CAPTCHA challenges
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Ban severity levels
 */
export type BanSeverity = 'warning' | 'temporary' | 'permanent';

/**
 * Ban scope types
 */
export type BanType = 'server' | 'network';

/**
 * Request source types
 */
export type RequestSource = 'auto' | 'manual';

/**
 * Approval decisions
 */
export type ApprovalDecision = 'approved' | 'rejected';

// ==================== Validation Constraints ====================

/**
 * Validation constraints for certificate management
 */
export const VALIDATION_CONSTRAINTS = {
  /** Maximum trust chain depth */
  MAX_CHAIN_DEPTH: 5,

  /** CAPTCHA rate limit: attempts per hour per callsign */
  CAPTCHA_RATE_LIMIT: 3,

  /** CAPTCHA expiration time in minutes */
  CAPTCHA_EXPIRATION_MINUTES: 60,

  /** Certificate verification cache duration in minutes */
  CERT_VERIFICATION_CACHE_MINUTES: 60,

  /** Request expiration time in hours */
  REQUEST_EXPIRATION_HOURS: 24,

  /** Default maximum CAPTCHA uses */
  DEFAULT_MAX_CAPTCHA_USES: 1,

  /** Minimum consensus threshold for trust chains */
  MIN_CONSENSUS_THRESHOLD: 2
} as const;

// ==================== IndexedDB Store Configuration ====================

/**
 * IndexedDB store names and indexes for certificate management
 */
export const CERTIFICATE_STORES = {
  CERTIFICATES: {
    name: 'certificates',
    keyPath: 'id',
    indexes: {
      BY_CALLSIGN: 'by_callsign',
      BY_TYPE: 'by_type',
      BY_TRUST_LEVEL: 'by_trust_level',
      BY_EXPIRATION: 'by_expiration'
    }
  },
  CERTIFICATE_REQUESTS: {
    name: 'certificate_requests',
    keyPath: 'id',
    indexes: {
      BY_CALLSIGN: 'by_callsign',
      BY_SERVER: 'by_server',
      BY_STATUS: 'by_status',
      BY_SUBMITTED_AT: 'by_submitted_at'
    }
  },
  CAPTCHA_SOLUTIONS: {
    name: 'captcha_solutions',
    keyPath: 'id',
    indexes: {
      BY_SOLVER: 'by_solver',
      BY_CHALLENGE_ID: 'by_challenge_id',
      BY_SOLVED_AT: 'by_solved_at'
    }
  },
  TRUST_CHAINS: {
    name: 'trust_chains',
    keyPath: 'id',
    indexes: {
      BY_ROOT_CERT: 'by_root_cert',
      BY_LEAF_CERT: 'by_leaf_cert',
      BY_LAST_VALIDATED: 'by_last_validated'
    }
  },
  BAN_RECORDS: {
    name: 'ban_records',
    keyPath: 'id',
    indexes: {
      BY_CALLSIGN: 'by_callsign',
      BY_SERVER: 'by_server',
      BY_BANNED_AT: 'by_banned_at'
    }
  }
} as const;