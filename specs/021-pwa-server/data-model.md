# Data Model: PWA Server with Station Setup Download

## Entity Overview

This document defines the data entities for the PWA server feature, including server packages, platform binaries, PWA assets, deployment configurations, and certificate management.

## Core Entities

### ServerPackage

Represents the complete server distribution package containing all platform binaries and PWA assets.

```typescript
interface ServerPackage {
  /** Unique identifier for the package */
  id: string;

  /** Package version (semantic versioning) */
  version: string;

  /** Human-readable package name */
  name: string;

  /** Package description for user display */
  description: string;

  /** Package creation timestamp */
  createdAt: Date;

  /** Total package size in bytes */
  size: number;

  /** SHA-256 checksum for integrity verification */
  checksum: string;

  /** Download URL or path */
  downloadUrl: string;

  /** Array of included platform binaries */
  binaries: PlatformBinary[];

  /** PWA assets included in package */
  pwaAssets: PWAAssets;

  /** Package metadata and manifest */
  manifest: PackageManifest;

  /** Emergency preparedness documentation */
  emergencyDocs: EmergencyDocumentation;
}
```

### PlatformBinary

Represents an operating system and architecture-specific executable binary.

```typescript
interface PlatformBinary {
  /** Unique identifier for the binary */
  id: string;

  /** Operating system (linux, macos, windows) */
  platform: 'linux' | 'macos' | 'windows';

  /** CPU architecture (x64, arm64) */
  architecture: 'x64' | 'arm64';

  /** Binary filename with extension */
  filename: string;

  /** Binary file size in bytes */
  size: number;

  /** SHA-256 checksum for integrity */
  checksum: string;

  /** Relative path within package */
  path: string;

  /** Executable permissions (Unix systems) */
  permissions: string;

  /** Binary creation timestamp */
  createdAt: Date;

  /** Node.js version used for compilation */
  nodeVersion: string;

  /** PKG version used for packaging */
  pkgVersion: string;

  /** Startup script for this platform */
  startupScript: string;
}
```

### PWAAssets

Represents the Progressive Web Application build files and assets.

```typescript
interface PWAAssets {
  /** Unique identifier for PWA assets */
  id: string;

  /** PWA build version */
  version: string;

  /** Build timestamp */
  buildDate: Date;

  /** Total assets size in bytes */
  totalSize: number;

  /** Root directory path within package */
  rootPath: string;

  /** Main entry file (index.html) */
  entryFile: AssetFile;

  /** PWA manifest file */
  manifest: AssetFile;

  /** Service worker file */
  serviceWorker: AssetFile;

  /** All static assets (CSS, JS, images) */
  staticAssets: AssetFile[];

  /** PWA icons for different sizes */
  icons: PWAIcon[];

  /** Asset integrity checksums */
  integrity: AssetIntegrity;
}

interface AssetFile {
  /** Filename with extension */
  filename: string;

  /** Relative path from PWA root */
  path: string;

  /** File size in bytes */
  size: number;

  /** MIME type for proper serving */
  mimeType: string;

  /** SHA-256 checksum */
  checksum: string;

  /** Whether file requires special headers */
  requiresNoCache: boolean;

  /** Cache control directives */
  cacheControl?: string;
}

interface PWAIcon {
  /** Icon filename */
  filename: string;

  /** Icon path relative to PWA root */
  path: string;

  /** Icon size (e.g., "192x192") */
  size: string;

  /** Icon format (png, svg, ico) */
  format: 'png' | 'svg' | 'ico';

  /** Icon purpose (any, maskable, monochrome) */
  purpose: string;

  /** File size in bytes */
  fileSize: number;
}

interface AssetIntegrity {
  /** Overall assets checksum */
  overallChecksum: string;

  /** Individual file checksums */
  fileChecksums: Record<string, string>;

  /** Integrity verification method */
  method: 'sha256' | 'sha384' | 'sha512';
}
```

### DeploymentConfig

Represents server deployment configuration and runtime settings.

```typescript
interface DeploymentConfig {
  /** Unique configuration identifier */
  id: string;

  /** Configuration name/label */
  name: string;

  /** Server listening port */
  port: number;

  /** Server bind address */
  bindAddress: string;

  /** PWA assets directory path */
  pwaAssetsPath: string;

  /** Certificate storage directory */
  certificatePath: string;

  /** Database file path */
  databasePath: string;

  /** Logging configuration */
  logging: LoggingConfig;

  /** Server security settings */
  security: SecurityConfig;

  /** PWA serving configuration */
  pwaServing: PWAServingConfig;

  /** Emergency mode settings */
  emergencyMode: EmergencyModeConfig;

  /** Configuration creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  updatedAt: Date;
}

interface LoggingConfig {
  /** Log level (error, warn, info, debug) */
  level: 'error' | 'warn' | 'info' | 'debug';

  /** Log file path */
  filePath?: string;

  /** Maximum log file size */
  maxFileSize: number;

  /** Number of log files to rotate */
  maxFiles: number;

  /** Enable console logging */
  console: boolean;
}

interface SecurityConfig {
  /** Require HTTPS for PWA serving */
  requireHttps: boolean;

  /** CORS configuration */
  cors: CORSConfig;

  /** Certificate validation settings */
  certificateValidation: boolean;

  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
}

interface CORSConfig {
  /** Allowed origins */
  allowedOrigins: string[];

  /** Allowed methods */
  allowedMethods: string[];

  /** Allowed headers */
  allowedHeaders: string[];

  /** Enable credentials */
  credentials: boolean;
}

interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;

  /** Time window in milliseconds */
  windowMs: number;

  /** Enable rate limiting */
  enabled: boolean;
}

interface PWAServingConfig {
  /** Enable PWA serving */
  enabled: boolean;

  /** Cache control for static assets */
  staticCacheControl: string;

  /** Cache control for service worker */
  serviceWorkerCacheControl: string;

  /** Enable compression */
  compression: boolean;

  /** Maximum file size to serve */
  maxFileSize: number;
}

interface EmergencyModeConfig {
  /** Enable emergency mode features */
  enabled: boolean;

  /** Emergency contact information */
  emergencyContact: EmergencyContact;

  /** Simplified interface for emergency use */
  simplifiedInterface: boolean;

  /** Emergency message configuration */
  emergencyMessages: EmergencyMessage[];
}

interface EmergencyContact {
  /** Emergency operator callsign */
  callsign: string;

  /** Contact frequency */
  frequency: string;

  /** Additional contact info */
  notes: string;
}

interface EmergencyMessage {
  /** Message type */
  type: 'info' | 'warning' | 'critical';

  /** Message content */
  content: string;

  /** Display conditions */
  conditions: string[];
}
```

### RootCertificate

Represents root certificate for bootstrapping trust chain in fresh deployments.

```typescript
interface RootCertificate {
  /** Unique certificate identifier */
  id: string;

  /** Certificate in PEM format */
  certificatePem: string;

  /** Associated callsign */
  callsign: string;

  /** Certificate common name */
  commonName: string;

  /** Certificate subject */
  subject: CertificateSubject;

  /** Certificate issuer */
  issuer: CertificateSubject;

  /** Certificate validity period */
  validity: CertificateValidity;

  /** Public key information */
  publicKey: PublicKeyInfo;

  /** Certificate fingerprint */
  fingerprint: string;

  /** Whether this is a root certificate */
  isRoot: boolean;

  /** Certificate installation timestamp */
  installedAt: Date;

  /** Certificate status */
  status: 'active' | 'revoked' | 'expired';

  /** Trust level */
  trustLevel: 'root' | 'intermediate' | 'leaf';

  /** Certificate usage restrictions */
  keyUsage: string[];

  /** Extended key usage */
  extendedKeyUsage: string[];
}

interface CertificateSubject {
  /** Common name */
  commonName: string;

  /** Organization */
  organization?: string;

  /** Country code */
  country?: string;

  /** State or province */
  state?: string;

  /** Locality */
  locality?: string;

  /** Email address */
  email?: string;
}

interface CertificateValidity {
  /** Valid from date */
  notBefore: Date;

  /** Valid until date */
  notAfter: Date;

  /** Whether certificate is currently valid */
  isValid: boolean;

  /** Days until expiration */
  daysUntilExpiration: number;
}

interface PublicKeyInfo {
  /** Key algorithm (ECDSA, RSA) */
  algorithm: 'ECDSA' | 'RSA';

  /** Key size in bits */
  keySize: number;

  /** Curve name for ECDSA */
  curve?: string;

  /** Public key in PEM format */
  publicKeyPem: string;

  /** Key fingerprint */
  fingerprint: string;
}
```

## Supporting Entities

### PackageManifest

Metadata about server package contents and structure.

```typescript
interface PackageManifest {
  /** Manifest format version */
  manifestVersion: string;

  /** Package structure version */
  packageVersion: string;

  /** Build information */
  buildInfo: BuildInfo;

  /** File structure mapping */
  fileStructure: FileStructureMap;

  /** Installation instructions */
  installationInstructions: InstallationInstructions;

  /** System requirements */
  systemRequirements: SystemRequirements;

  /** Verification instructions */
  verification: VerificationInstructions;
}

interface BuildInfo {
  /** Build timestamp */
  buildDate: Date;

  /** Build environment */
  environment: string;

  /** Source code version/commit */
  sourceVersion: string;

  /** Builder information */
  builder: string;

  /** Build dependencies */
  dependencies: Record<string, string>;
}

interface FileStructureMap {
  /** Root directory structure */
  root: DirectoryStructure;

  /** Binary directories */
  binaries: Record<string, DirectoryStructure>;

  /** PWA assets directory */
  pwaAssets: DirectoryStructure;

  /** Configuration directory */
  config: DirectoryStructure;
}

interface DirectoryStructure {
  /** Directory name */
  name: string;

  /** Directory path */
  path: string;

  /** Files in directory */
  files: FileDescriptor[];

  /** Subdirectories */
  subdirectories: DirectoryStructure[];
}

interface FileDescriptor {
  /** Filename */
  name: string;

  /** File size */
  size: number;

  /** File type */
  type: string;

  /** File checksum */
  checksum: string;

  /** File permissions */
  permissions?: string;
}

interface InstallationInstructions {
  /** General installation steps */
  general: InstallationStep[];

  /** Platform-specific instructions */
  platformSpecific: Record<string, InstallationStep[]>;

  /** Post-installation verification */
  verification: VerificationStep[];

  /** Troubleshooting guidance */
  troubleshooting: TroubleshootingStep[];
}

interface InstallationStep {
  /** Step number */
  order: number;

  /** Step description */
  description: string;

  /** Command to execute (if applicable) */
  command?: string;

  /** Expected outcome */
  expectedResult: string;

  /** Step type */
  type: 'extract' | 'copy' | 'execute' | 'configure' | 'verify';
}

interface VerificationStep {
  /** Verification name */
  name: string;

  /** Verification command */
  command: string;

  /** Expected output pattern */
  expectedOutput: string;

  /** Failure remediation */
  onFailure: string;
}

interface TroubleshootingStep {
  /** Problem description */
  problem: string;

  /** Possible causes */
  causes: string[];

  /** Solution steps */
  solutions: string[];

  /** Additional resources */
  resources: string[];
}

interface SystemRequirements {
  /** Minimum operating system versions */
  operatingSystems: OSRequirement[];

  /** Memory requirements */
  memory: MemoryRequirement;

  /** Disk space requirements */
  diskSpace: DiskSpaceRequirement;

  /** Network requirements */
  network: NetworkRequirement;

  /** Additional software dependencies */
  dependencies: SoftwareDependency[];
}

interface OSRequirement {
  /** Operating system name */
  os: string;

  /** Minimum version */
  minVersion: string;

  /** Architecture support */
  architectures: string[];

  /** Additional notes */
  notes?: string;
}

interface MemoryRequirement {
  /** Minimum RAM in MB */
  minimum: number;

  /** Recommended RAM in MB */
  recommended: number;

  /** Notes about memory usage */
  notes: string;
}

interface DiskSpaceRequirement {
  /** Minimum disk space in MB */
  minimum: number;

  /** Recommended disk space in MB */
  recommended: number;

  /** Additional space for data */
  additionalSpace: number;

  /** Notes about disk usage */
  notes: string;
}

interface NetworkRequirement {
  /** Required ports */
  ports: number[];

  /** Network protocols */
  protocols: string[];

  /** Firewall considerations */
  firewallNotes: string;

  /** Offline operation capability */
  offlineCapable: boolean;
}

interface SoftwareDependency {
  /** Dependency name */
  name: string;

  /** Version requirement */
  version: string;

  /** Whether dependency is optional */
  optional: boolean;

  /** Installation instructions */
  installationNotes: string;
}

interface VerificationInstructions {
  /** Package integrity verification */
  packageIntegrity: IntegrityCheck[];

  /** Binary verification */
  binaryVerification: IntegrityCheck[];

  /** PWA assets verification */
  assetVerification: IntegrityCheck[];

  /** Installation verification */
  installationVerification: FunctionalCheck[];
}

interface IntegrityCheck {
  /** File or component to check */
  target: string;

  /** Checksum algorithm */
  algorithm: string;

  /** Expected checksum */
  expectedChecksum: string;

  /** Verification command */
  command: string;
}

interface FunctionalCheck {
  /** Check name */
  name: string;

  /** Check description */
  description: string;

  /** Test command */
  command: string;

  /** Success criteria */
  successCriteria: string;

  /** Failure remediation */
  onFailure: string;
}
```

### EmergencyDocumentation

Emergency preparedness and deployment documentation.

```typescript
interface EmergencyDocumentation {
  /** Documentation version */
  version: string;

  /** Quick start guide for emergencies */
  quickStart: EmergencyQuickStart;

  /** Deployment scenarios */
  deploymentScenarios: EmergencyScenario[];

  /** Operating procedures */
  operatingProcedures: OperatingProcedure[];

  /** Troubleshooting guide */
  troubleshooting: EmergencyTroubleshooting;

  /** Contact information */
  emergencyContacts: EmergencyContactInfo[];
}

interface EmergencyQuickStart {
  /** Essential steps for immediate deployment */
  essentialSteps: QuickStartStep[];

  /** Minimum configuration required */
  minimumConfig: ConfigurationItem[];

  /** Critical verification checks */
  criticalChecks: VerificationItem[];

  /** Emergency contact establishment */
  contactEstablishment: ContactStep[];
}

interface QuickStartStep {
  /** Step number */
  order: number;

  /** Step title */
  title: string;

  /** Detailed instructions */
  instructions: string;

  /** Time estimate */
  estimatedTime: string;

  /** Priority level */
  priority: 'critical' | 'high' | 'medium';

  /** Dependencies */
  dependencies: string[];
}

interface ConfigurationItem {
  /** Configuration parameter */
  parameter: string;

  /** Default value */
  defaultValue: string;

  /** Emergency override value */
  emergencyValue?: string;

  /** Configuration importance */
  importance: 'critical' | 'important' | 'optional';

  /** Configuration notes */
  notes: string;
}

interface VerificationItem {
  /** What to verify */
  item: string;

  /** Verification method */
  method: string;

  /** Expected result */
  expectedResult: string;

  /** Failure action */
  onFailure: string;
}

interface ContactStep {
  /** Contact establishment step */
  step: string;

  /** Required information */
  requiredInfo: string[];

  /** Communication method */
  method: string;

  /** Backup procedures */
  backupProcedures: string[];
}

interface EmergencyScenario {
  /** Scenario name */
  name: string;

  /** Scenario description */
  description: string;

  /** Deployment considerations */
  deploymentConsiderations: string[];

  /** Special configuration */
  specialConfig: ConfigurationOverride[];

  /** Communication procedures */
  communicationProcedures: CommunicationProcedure[];

  /** Resource requirements */
  resourceRequirements: ResourceRequirement[];
}

interface ConfigurationOverride {
  /** Parameter to override */
  parameter: string;

  /** Override value */
  value: string;

  /** Reason for override */
  reason: string;

  /** Impact of change */
  impact: string;
}

interface CommunicationProcedure {
  /** Procedure name */
  name: string;

  /** Frequency or channel */
  frequency: string;

  /** Protocol to follow */
  protocol: string;

  /** Emergency codes */
  emergencyCodes: string[];
}

interface ResourceRequirement {
  /** Required resource */
  resource: string;

  /** Quantity needed */
  quantity: string;

  /** Criticality */
  criticality: 'essential' | 'important' | 'nice-to-have';

  /** Alternatives */
  alternatives: string[];
}

interface OperatingProcedure {
  /** Procedure name */
  name: string;

  /** Procedure purpose */
  purpose: string;

  /** Step-by-step instructions */
  steps: ProcedureStep[];

  /** Safety considerations */
  safetyConsiderations: string[];

  /** Common mistakes to avoid */
  commonMistakes: string[];
}

interface ProcedureStep {
  /** Step number */
  order: number;

  /** Step action */
  action: string;

  /** Expected outcome */
  expectedOutcome: string;

  /** If step fails */
  onFailure: string;

  /** Additional notes */
  notes?: string;
}

interface EmergencyTroubleshooting {
  /** Common problems and solutions */
  commonProblems: TroubleshootingItem[];

  /** Diagnostic procedures */
  diagnosticProcedures: DiagnosticProcedure[];

  /** Recovery procedures */
  recoveryProcedures: RecoveryProcedure[];

  /** Emergency contacts for technical support */
  technicalSupport: TechnicalSupportContact[];
}

interface TroubleshootingItem {
  /** Problem description */
  problem: string;

  /** Symptoms */
  symptoms: string[];

  /** Likely causes */
  likelyCauses: string[];

  /** Solution steps */
  solutions: string[];

  /** Prevention measures */
  prevention: string[];
}

interface DiagnosticProcedure {
  /** Diagnostic name */
  name: string;

  /** When to use this diagnostic */
  whenToUse: string;

  /** Diagnostic steps */
  steps: string[];

  /** What results indicate */
  resultInterpretation: ResultInterpretation[];
}

interface ResultInterpretation {
  /** Observed result */
  result: string;

  /** What it means */
  meaning: string;

  /** Recommended action */
  action: string;
}

interface RecoveryProcedure {
  /** Recovery scenario */
  scenario: string;

  /** Recovery steps */
  steps: string[];

  /** Data protection measures */
  dataProtection: string[];

  /** Time to recovery estimate */
  timeEstimate: string;
}

interface TechnicalSupportContact {
  /** Contact role */
  role: string;

  /** Callsign */
  callsign: string;

  /** Contact methods */
  contactMethods: ContactMethod[];

  /** Expertise areas */
  expertise: string[];

  /** Availability */
  availability: string;
}

interface ContactMethod {
  /** Method type */
  type: 'radio' | 'phone' | 'email' | 'message';

  /** Contact details */
  details: string;

  /** Preferred hours */
  preferredHours: string;

  /** Backup method */
  backup?: string;
}

interface EmergencyContactInfo {
  /** Contact purpose */
  purpose: string;

  /** Primary contact */
  primaryContact: TechnicalSupportContact;

  /** Backup contacts */
  backupContacts: TechnicalSupportContact[];

  /** Emergency protocols */
  protocols: string[];
}
```

## Entity Relationships

### Primary Relationships
- **ServerPackage** contains multiple **PlatformBinary** instances
- **ServerPackage** includes one **PWAAssets** instance
- **ServerPackage** has one **PackageManifest**
- **DeploymentConfig** references **PWAAssets** location
- **RootCertificate** supports **DeploymentConfig** security
- **EmergencyDocumentation** provides guidance for **DeploymentConfig**

### Data Flow
1. **ServerPackage** created with all **PlatformBinary** and **PWAAssets**
2. **PackageManifest** generated from package contents
3. **DeploymentConfig** created during installation
4. **RootCertificate** established during first-time setup
5. **EmergencyDocumentation** guides deployment scenarios

### Storage Considerations
- **ServerPackage**: File system (ZIP archive)
- **PlatformBinary**: File system (executable files)
- **PWAAssets**: File system (static files)
- **DeploymentConfig**: Configuration file (JSON)
- **RootCertificate**: Secure certificate store
- **EmergencyDocumentation**: Embedded documentation files

---

*Data Model Version 1.0*
*Phase 1a: Entity Design Complete*
*Created: 2025-09-18*