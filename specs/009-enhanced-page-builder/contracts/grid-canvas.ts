/**
 * GridCanvas Contract: Nested component rendering
 * Generated from functional requirements FR-004, FR-005, FR-009, FR-011
 */

import { PageComponent } from '../../../src/pages/PageBuilder';

export interface GridCanvasContract {
  // Existing core methods
  components: PageComponent[];
  onSelectComponent: (component: PageComponent | null) => void;
  onUpdateComponent: (id: string, updates: Partial<PageComponent>) => void;

  // Enhanced for children support
  selectedComponent: PageComponent | null;
}

export interface ChildRenderingMethods {
  /**
   * Render individual child component
   * Requirements: FR-004 (render nested components visually)
   */
  renderChildComponent(child: PageComponent, index: number): React.ReactNode;

  /**
   * Enhanced component content rendering with children
   * Requirements: FR-004 (visual rendering), FR-011 (visual indicators)
   */
  renderComponentContent(): React.ReactNode;

  /**
   * Handle nested component interactions
   * Requirements: FR-005 (maintain relationships during drag/drop)
   */
  handleNestedComponentDrag(componentId: string): void;
}

export interface ContainerRenderingContract {
  /**
   * Render Form container with children
   * Requirements: FR-004 (container-specific rendering)
   */
  renderFormContainer(children: PageComponent[]): React.ReactNode;

  /**
   * Render List container with children
   * Requirements: FR-004 (bulleted list layout)
   */
  renderListContainer(children: PageComponent[]): React.ReactNode;

  /**
   * Render Table container with children
   * Requirements: FR-004 (table row layout)
   */
  renderTableContainer(children: PageComponent[]): React.ReactNode;

  /**
   * Render generic Container with children
   * Requirements: FR-004 (free-form arrangement)
   */
  renderGenericContainer(children: PageComponent[]): React.ReactNode;
}

// Test Contracts (must fail initially)
export interface GridCanvasTestContract {
  /**
   * Test: Container shows empty state when no children
   * User Story: Empty containers display helpful message
   */
  shouldShowEmptyStateForContainers(componentType: string): boolean;

  /**
   * Test: Children render nested inside parent
   * User Story: Child components appear visually nested within containers
   */
  shouldRenderChildrenNested(parentId: string, childIds: string[]): boolean;

  /**
   * Test: Container shows child count indicator
   * User Story: Containers display count of nested components
   */
  shouldShowChildCountIndicator(parentId: string, expectedCount: number): boolean;

  /**
   * Test: Moving parent preserves children
   * User Story: Dragging container moves all children together
   */
  shouldPreserveChildrenOnParentMove(parentId: string, newPosition: GridPosition): boolean;
}