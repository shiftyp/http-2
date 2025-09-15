/**
 * PageBuilder Contract: Enhanced component management with children
 * Generated from functional requirements FR-005, FR-007, FR-012, FR-013
 */

import { PageComponent } from '../../../src/pages/PageBuilder';

export interface PageBuilderContract {
  // Existing state management
  components: PageComponent[];
  selectedComponent: PageComponent | null;
  setComponents: (components: PageComponent[]) => void;
  setSelectedComponent: (component: PageComponent | null) => void;

  // Enhanced component operations
  updateComponent: (id: string, updates: Partial<PageComponent>) => void;
  deleteComponent: (id: string) => void;
  duplicateComponent: (id: string) => void;
}

export interface HierarchyManagementMethods {
  /**
   * Count nested children recursively
   * Requirements: FR-013 (deletion warning with count)
   */
  countNestedChildren(component: PageComponent): number;

  /**
   * Validate component hierarchy integrity
   * Requirements: FR-007 (prevent circular nesting)
   */
  validateHierarchy(components: PageComponent[]): boolean;

  /**
   * Handle drag operations preserving children
   * Requirements: FR-005 (maintain relationships during drag/drop)
   */
  handleDragEndWithChildren(event: DragEndEvent): void;

  /**
   * Enhanced component deletion with warnings
   * Requirements: FR-012, FR-013 (delete children, show warning)
   */
  deleteComponentWithWarning(id: string): void;
}

export interface ComponentSelectionContract {
  /**
   * Handle child component selection
   * Requirements: FR-006, FR-010 (edit individual child properties)
   */
  handleChildSelection(child: PageComponent): void;

  /**
   * Switch property editor context
   * Requirements: Support seamless parent/child editing
   */
  switchPropertyEditorContext(component: PageComponent): void;
}

// Test Contracts (must fail initially)
export interface PageBuilderTestContract {
  /**
   * Test: Deletion warning shows child count
   * User Story: Warning dialog displays number of nested components
   */
  shouldShowDeletionWarning(componentId: string, expectedChildCount: number): boolean;

  /**
   * Test: Circular nesting prevention
   * User Story: System prevents component from containing itself
   */
  shouldPreventCircularNesting(parentId: string, childId: string): boolean;

  /**
   * Test: Drag preserves child relationships
   * User Story: Moving parent component keeps all children attached
   */
  shouldPreserveChildrenOnDrag(parentId: string, newGridArea: GridPosition): boolean;

  /**
   * Test: Child selection switches property editor
   * User Story: Selecting child component loads its properties for editing
   */
  shouldSwitchToChildProperties(childId: string): boolean;

  /**
   * Test: Component update preserves children
   * User Story: Updating parent properties doesn't affect children
   */
  shouldPreserveChildrenOnUpdate(parentId: string, updates: Partial<PageComponent>): boolean;
}