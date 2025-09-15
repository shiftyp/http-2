/**
 * PropertyEditor Contract: Enhanced page builder child management
 * Generated from functional requirements FR-002, FR-003, FR-006, FR-010
 */

import { PageComponent, ComponentType } from '../../../src/pages/PageBuilder';

export interface PropertyEditorContract {
  // Existing core methods
  onUpdate: (updates: Partial<PageComponent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;

  // NEW: Child component management methods
  onAddChild?: (childComponent: PageComponent) => void;
  onRemoveChild?: (childId: string) => void;
  onSelectChild?: (childComponent: PageComponent) => void;
}

export interface ChildManagementMethods {
  /**
   * Add new child component to selected parent
   * Requirements: FR-003 (add child components)
   */
  addChildComponent(type: ComponentType): void;

  /**
   * Remove child component by ID
   * Requirements: FR-003 (remove child components), FR-013 (deletion warning)
   */
  removeChildComponent(childId: string): void;

  /**
   * Get default properties for component type
   * Requirements: FR-001 (component creation)
   */
  getDefaultPropsForType(type: ComponentType): ComponentProps;
}

export interface ChildrenTabContract {
  /**
   * Render children management UI
   * Requirements: FR-002 (Children tab display)
   */
  renderChildrenProperties(): React.ReactNode;

  /**
   * Handle child component selection for editing
   * Requirements: FR-006, FR-010 (edit individual child properties)
   */
  handleChildSelection(child: PageComponent): void;

  /**
   * Display child count in tab indicator
   * Requirements: FR-011 (visual indicators)
   */
  getChildCount(): number;
}

// Test Contracts (must fail initially)
export interface PropertyEditorTestContract {
  /**
   * Test: Children tab appears when component selected
   * User Story: Selected component shows children tab in property editor
   */
  shouldShowChildrenTab(component: PageComponent): boolean;

  /**
   * Test: Add child dropdown functionality
   * User Story: User can add child components via dropdown
   */
  shouldAddChildOnDropdownSelection(parentId: string, childType: ComponentType): boolean;

  /**
   * Test: Child editing switches context
   * User Story: Clicking Edit button switches to child property editing
   */
  shouldSwitchToChildContext(childId: string): boolean;

  /**
   * Test: Child deletion with confirmation
   * User Story: Delete button removes child with user confirmation
   */
  shouldRemoveChildWithConfirmation(childId: string): boolean;
}