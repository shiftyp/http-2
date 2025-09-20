# Kiro IDE Configuration for HTTP-over-Ham-Radio

This directory contains Kiro IDE-specific configuration files for the HTTP-over-Ham-Radio project, optimizing the development experience for amateur radio communication protocols and FCC compliance.

## Configuration Files

### Core Configuration
- **`workspace.json`** - Main workspace configuration with amateur radio features
- **`project.json`** - Project metadata and specification tracking
- **`spec-integration.json`** - Complete specification status and integration

### Development Tools
- **`agent-hooks.json`** - Agent hooks for spec validation and FCC compliance
- **`mcp-tools.json`** - Domain knowledge and context for amateur radio development
- **`commands.json`** - Custom commands for radio protocol development

### Templates and Scripts
- **`templates/`** - Code templates for radio components and protocols
- **`scripts/`** - Automation scripts for spec tracking and validation
- **`validators/`** - FCC compliance and protocol validation tools

## Key Features

### Specification-Driven Development
- **26 specifications** tracked with automatic progress monitoring
- **1,434 tasks** across all specifications with completion tracking
- **Priority-based development** focusing on essential radio functionality

### Amateur Radio Domain Expertise
- **FCC Part 97 compliance** validation and enforcement
- **Protocol optimization** for QPSK, OFDM, and mesh networking
- **Bandwidth constraints** enforced for amateur radio limits (2.8kHz HF)
- **Station identification** and automatic control compliance

### Essential Specifications Priority
1. **001-web-based-application** - Core PWA architecture
2. **023-ofdm** - High-speed 48-subcarrier transmission (100+ kbps)
3. **025-fcc-compliance-implementation** - Regulatory compliance framework
4. **027-automatic-shutdown** - Required automatic station control
5. **009-enhanced-page-builder** - Visual content creation system
6. **014-webrtc-transmission-mode** - Hybrid transmission modes
7. **013-bit-torrent-protocol** - Mesh content distribution
8. **020-certificate-management** - Trust and security framework

### Radio Protocol Features
- **QPSK modulation** with adaptive symbol rates (31.25 - 9600 baud)
- **OFDM implementation** with 48 parallel subcarriers
- **Mesh networking** using AODV routing protocol
- **SDR integration** for RTL-SDR, HackRF, LimeSDR, PlutoSDR
- **WebRTC hybrid mode** with automatic RF fallback

### Development Enhancements
- **Real-time spec tracking** with automatic task updates
- **FCC compliance checking** integrated into development workflow
- **Bandwidth optimization** with live compression feedback
- **Protocol validation** for amateur radio constraints
- **Hardware simulation** for radio testing without physical equipment

## Usage with Kiro IDE

1. **Open project** in Kiro IDE - configuration is automatically detected
2. **Use custom commands** via Command Palette (Cmd+Shift+P)
3. **Leverage agent hooks** for automatic compliance checking
4. **Follow spec priorities** for essential functionality development
5. **Monitor progress** through integrated specification tracking

## Commands Quick Reference

- **Cmd+Shift+S** - Show specification status
- **Cmd+Shift+F** - Validate FCC compliance
- **Cmd+Shift+R** - Test radio protocols
- **Cmd+Shift+C** - Run specification contract tests

## Development Workflow

1. **Select specification** from priority list
2. **Use templates** for radio-compliant components
3. **Validate compliance** with automatic hooks
4. **Test protocols** with simulation tools
5. **Track progress** through specification integration

This configuration enables rapid development of amateur radio communication systems while ensuring FCC Part 97 compliance and optimal bandwidth utilization for ham radio constraints.