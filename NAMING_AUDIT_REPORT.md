# Code Naming Audit Report

## Executive Summary
This audit examines the naming conventions across the HTTP Over Ham Radio codebase, including folder structure, file naming, and code constructs.

## 1. Spec Directory Structure

### ✅ Consistent Patterns
- Numbered feature branches: `001-web-based-application`, `002-a-feature-whereby`
- Standard spec files: `spec.md`, `plan.md`, `research.md`, `tasks.md`, `data-model.md`
- Follows Spec Kit conventions

### ⚠️ Issues Found
- **Inconsistent feature naming**: Mix of descriptive (`web-based-application`) and vague (`a-feature-whereby`) names
- **Recommendation**: Use descriptive kebab-case names consistently

## 2. Library Folder Organization

### ✅ Consistent Patterns
- Kebab-case folder naming: `qpsk-modem`, `radio-control`, `mesh-networking`
- Single `index.ts` entry point per module
- Test files colocated: `*.test.ts`

### ⚠️ Issues Found
- **Duplicate/Legacy folders**: Both `mesh` and `mesh-networking`, `radio` and `radio-control`
- **Inconsistent granularity**: Some folders are features (`ham-server`), others are utilities (`compression`)
- **Orphaned folders**: `function-runtime`, `themes`, `orm` appear unused
- **Recommendation**: Remove duplicate folders, consolidate related functionality

## 3. Component & Page Naming

### ✅ Consistent Patterns
- PascalCase for React components: `MeshNetwork.tsx`, `RadioControl.tsx`
- Components have matching CSS files when needed
- UI components properly organized in `ui/` subfolder

### ⚠️ Issues Found
- **Component naming inconsistency**: `MeshNetworkView` export vs `MeshNetwork.tsx` filename
- **Mixed file types in pages**: Both `.tsx` and `.css` files at same level
- **Recommendation**: Component export names should match filenames

## 4. Test File Organization

### ✅ Consistent Patterns
- Unit tests colocated: `crypto.test.ts` next to `index.ts`
- Integration tests in dedicated folder: `src/test/integration/`
- Clear test type distinction: `*.test.ts` vs `*.integration.test.ts`

### ⚠️ Issues Found
- **Inconsistent test naming**: `protocol-stack.test.ts` vs `mesh-networking.integration.test.ts`
- **Missing pattern**: Some integration tests lack `.integration` suffix
- **Recommendation**: Standardize on `*.integration.test.ts` for all integration tests

## 5. Code Construct Naming

### ✅ Consistent Patterns
- **Interfaces**: PascalCase with descriptive names (`RadioConfig`, `MeshNode`)
- **Classes**: PascalCase with noun names (`RadioControl`, `HTTPServer`)
- **Constants**: UPPER_SNAKE_CASE (`RADIO_CONFIGS`, `MODULATION_SCHEMES`)
- **Types**: PascalCase (`FieldType`, `VNode`)

### ⚠️ Issues Found
- **Singleton exports**: Lowercase instances (`db`, `cryptoManager`, `logbook`) lack consistency
- **Mixed constant patterns**: `RADIO_TRANSMISSION_MODE` object vs `RADIO_CONFIGS` record
- **Generic names**: `Database`, `Table`, `ORM` too generic for domain-specific library
- **Recommendation**: Use consistent singleton naming pattern (`hamDB`, `hamCrypto`)

## 6. Major Naming Violations

### Critical Issues
1. **Ambiguous module names**: `compression` exports JSX utilities (unexpected)
2. **Protocol confusion**: `http-protocol` contains React renderer logic
3. **Missing namespace**: Generic names like `Database` should be `HamDatabase`
4. **Duplicate abstractions**: Both `HTTPPacket` and `MeshPacket` for similar concepts

## 7. Recommendations

### Immediate Actions
1. **Remove duplicate folders**: Delete `mesh/`, `radio/`, keep newer versions
2. **Rename singletons**: `db` → `hamDB`, `cryptoManager` → `hamCrypto`
3. **Fix test naming**: Add `.integration` suffix to all integration tests
4. **Clean orphaned code**: Remove unused `orm/`, `themes/`, `function-runtime/`

### Long-term Improvements
1. **Namespace domain objects**: Prefix with `Ham` or `Radio` (e.g., `HamDatabase`)
2. **Separate concerns**: Move React logic out of `http-protocol`
3. **Standardize exports**: All singletons as PascalCase or all as camelCase
4. **Document conventions**: Create CONTRIBUTING.md with naming guidelines

## Compliance Score
- **Folder Structure**: 7/10 (duplicates and orphans)
- **File Naming**: 8/10 (mostly consistent)
- **Code Constructs**: 7/10 (singleton inconsistency)
- **Domain Clarity**: 6/10 (generic names, mixed concerns)
- **Overall**: 7/10

## Priority Fixes
1. 🔴 Remove duplicate `mesh/` and `radio/` folders
2. 🔴 Standardize singleton naming pattern
3. 🟡 Fix integration test naming convention
4. 🟡 Separate React from protocol logic
5. 🟢 Document naming conventions