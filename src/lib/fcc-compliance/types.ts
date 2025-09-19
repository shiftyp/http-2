/**
 * FCC Compliance Types
 *
 * Types and interfaces for FCC Part 97 compliance automation
 * covering station identification, encryption control, and content filtering.
 */

export enum ComplianceLevel {
  COMPLIANT = 'compliant',
  WARNING = 'warning',
  VIOLATION = 'violation',
  EMERGENCY_OVERRIDE = 'emergency_override'
}

export enum TransmissionMode {
  RF = 'rf',           // Over radio frequency
  WEBRTC = 'webrtc',   // Over internet
  HYBRID = 'hybrid'    // Mixed mode
}

export enum ViolationType {
  ENCRYPTION_BLOCKED = 'encryption_blocked',
  STATION_ID_OVERDUE = 'station_id_overdue',
  CONTENT_FILTERED = 'content_filtered',
  BUSINESS_CONTENT = 'business_content',
  MUSIC_BLOCKED = 'music_blocked',
  POWER_EXCEEDED = 'power_exceeded',
  FREQUENCY_VIOLATION = 'frequency_violation'
}

/**
 * Station identification configuration per §97.119
 */
export interface StationIDConfig {
  callsign: string;
  automaticIDEnabled: boolean;
  intervalMinutes: number;          // Default: 10 minutes
  endOfTransmissionID: boolean;     // ID at end of transmission
  controlOperatorCallsign?: string; // For automatic operation
  emergencyCallsign?: string;       // Emergency operation callsign
}

/**
 * Station identification timer state
 */
export interface StationIDTimer {
  id: string;
  callsign: string;
  lastIDTime: Date;
  nextIDTime: Date;
  isOverdue: boolean;
  intervalMinutes: number;
  transmissionStartTime?: Date;
  warningTriggered: boolean;
}

/**
 * Compliance violation record
 */
export interface ComplianceViolation {
  id: string;
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;

  // Violation details
  description: string;
  regulation: string;        // e.g., "§97.119(a)"
  content?: string;         // Blocked content if applicable

  // Context
  transmissionMode: TransmissionMode;
  callsign: string;
  frequency?: number;
  power?: number;

  // Resolution
  blocked: boolean;         // Whether transmission was blocked
  overridden: boolean;      // Emergency override used
  resolvedAt?: Date;
  notes?: string;
}

/**
 * Content filter configuration
 */
export interface ContentFilterConfig {
  enabled: boolean;
  blockMusic: boolean;
  blockBusiness: boolean;
  profanityFilter: boolean;
  emergencyOverride: boolean;

  // Custom filters
  blockedWords: string[];
  blockedFileTypes: string[];
  maxFileSize: number;      // bytes

  // Content analysis
  musicDetectionEnabled: boolean;
  businessContentDetection: boolean;
}

/**
 * Encryption control configuration
 */
export interface EncryptionControlConfig {
  rfModeBlocking: boolean;  // Block encryption in RF mode
  webrtcModeAllowed: boolean; // Allow encryption in WebRTC mode
  signaturesAllowed: boolean; // Digital signatures always allowed
  emergencyOverride: boolean;

  // Detection settings
  cryptoFunctionMonitoring: boolean;
  contentAnalysis: boolean;
  headerInspection: boolean;
}

/**
 * FCC compliance configuration
 */
export interface FCCComplianceConfig {
  enabled: boolean;
  strictMode: boolean;       // Stricter than minimum requirements
  emergencyMode: boolean;    // Relaxed for emergency operations

  stationID: StationIDConfig;
  contentFilter: ContentFilterConfig;
  encryptionControl: EncryptionControlConfig;

  // Logging and audit
  auditLogging: boolean;
  violationLogging: boolean;
  complianceReporting: boolean;

  // Integration
  transmissionModeIntegration: boolean;
  meshNetworkCompliance: boolean;
  automaticShutdown: boolean;
}

/**
 * Compliance check result
 */
export interface ComplianceCheckResult {
  compliant: boolean;
  level: ComplianceLevel;
  violations: ComplianceViolation[];
  warnings: string[];

  // Specific checks
  stationIDCompliant: boolean;
  encryptionCompliant: boolean;
  contentCompliant: boolean;

  // Actions taken
  blocked: boolean;
  modified: boolean;
  logged: boolean;

  timestamp: Date;
}

/**
 * Content analysis result
 */
export interface ContentAnalysisResult {
  isMusic: boolean;
  isBusiness: boolean;
  hasProfanity: boolean;
  hasEncryption: boolean;

  confidence: number;       // 0-1 confidence score
  details: {
    musicGenre?: string;
    businessType?: string;
    profanityWords?: string[];
    encryptionType?: string;
  };

  recommendation: 'allow' | 'block' | 'warn' | 'modify';
  reasoning: string;
}

/**
 * Station identification event
 */
export interface StationIDEvent {
  type: 'automatic' | 'end_of_transmission' | 'manual' | 'emergency';
  callsign: string;
  timestamp: Date;
  transmissionDuration?: number; // seconds
  successful: boolean;
  error?: string;
}

/**
 * Compliance monitoring state
 */
export interface ComplianceMonitoringState {
  isActive: boolean;
  startTime: Date;
  currentMode: TransmissionMode;

  // Station ID tracking
  stationIDTimer: StationIDTimer;
  lastStationID: Date;

  // Transmission tracking
  currentTransmission?: {
    startTime: Date;
    mode: TransmissionMode;
    frequency?: number;
    power?: number;
  };

  // Violation tracking
  recentViolations: ComplianceViolation[];
  warningLevel: ComplianceLevel;

  // Emergency state
  emergencyOverrideActive: boolean;
  emergencyStartTime?: Date;
}

/**
 * FCC compliance event
 */
export interface ComplianceEvent {
  id: string;
  type: 'violation' | 'warning' | 'compliance' | 'station_id' | 'emergency';
  timestamp: Date;

  details: {
    callsign: string;
    mode: TransmissionMode;
    data: Record<string, any>;
  };

  // Automation response
  automated: boolean;
  action?: string;
  result?: string;
}

/**
 * Automatic compliance action
 */
export interface ComplianceAction {
  id: string;
  trigger: string;          // What triggered the action
  action: string;           // What action was taken
  timestamp: Date;

  // Context
  callsign: string;
  mode: TransmissionMode;
  automated: boolean;

  // Results
  successful: boolean;
  error?: string;
  duration: number;         // milliseconds
}

/**
 * Emergency override record
 */
export interface EmergencyOverride {
  id: string;
  callsign: string;
  startTime: Date;
  endTime?: Date;

  // Override details
  reason: string;
  authority: string;        // Who authorized override
  scope: string[];          // What regulations are overridden

  // Emergency context
  emergencyType: 'weather' | 'health' | 'safety' | 'disaster' | 'other';
  jurisdiction: string;     // Served agency

  // Compliance tracking
  violationsOverridden: ComplianceViolation[];
  postEmergencyReview: boolean;
}

/**
 * Compliance audit record
 */
export interface ComplianceAuditRecord {
  id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };

  // Summary statistics
  totalTransmissions: number;
  complianceRate: number;   // 0-1
  violationCount: number;
  warningCount: number;

  // Breakdown by type
  violationsByType: Record<ViolationType, number>;
  modeBreakdown: Record<TransmissionMode, {
    transmissions: number;
    violations: number;
    complianceRate: number;
  }>;

  // Station ID compliance
  stationIDCompliance: {
    onTimeCount: number;
    lateCount: number;
    missedCount: number;
    averageInterval: number; // minutes
  };

  // Recommendations
  recommendations: string[];
  actionItems: string[];
}

/**
 * Compliance system health
 */
export interface ComplianceSystemHealth {
  operational: boolean;
  lastCheck: Date;

  // Component status
  stationIDTimer: 'healthy' | 'warning' | 'error';
  contentFilter: 'healthy' | 'warning' | 'error';
  encryptionGuard: 'healthy' | 'warning' | 'error';

  // Performance metrics
  responseTime: number;     // milliseconds
  cpuUsage: number;        // percentage
  memoryUsage: number;     // bytes

  // Integration status
  transmissionModeIntegration: boolean;
  meshNetworkIntegration: boolean;
  certificateIntegration: boolean;

  errors: string[];
  warnings: string[];
}

/**
 * Regulatory reference
 */
export interface RegulationReference {
  section: string;          // e.g., "§97.119"
  title: string;
  description: string;
  url: string;             // Link to FCC regulation

  // Compliance requirements
  requirements: string[];
  penalties: string[];
  exemptions?: string[];
}

/**
 * Control operator session
 */
export interface ControlOperatorSession {
  id: string;
  operatorCallsign: string;
  stationCallsign: string;

  startTime: Date;
  endTime?: Date;

  // Session details
  authenticated: boolean;
  authority: string;        // Authority to operate
  supervision: 'direct' | 'indirect' | 'automatic';

  // Compliance responsibility
  complianceLevel: 'full' | 'limited' | 'emergency';
  overrideAuthority: boolean;

  // Activity tracking
  transmissionCount: number;
  violationCount: number;
  overrideCount: number;
}