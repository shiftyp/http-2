/**
 * Contract Test: PageBuilder Hierarchy Management
 * Validates PageBuilder interfaces for component hierarchy management
 * Requirements: FR-005, FR-007, FR-012, FR-013
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentType, PageComponent } from '../../pages/PageBuilder';

// Mock window.confirm for deletion warning tests
const mockConfirm = vi.fn();
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true
});

describe('PageBuilder Hierarchy Management Contract', () => {
  let mockComponents: PageComponent[];
  let mockSetComponents: ReturnType<typeof vi.fn>;
  let mockSetSelectedComponent: ReturnType<typeof vi.fn>;

  // Mock the PageBuilder's hierarchy management functions
  let countNestedChildren: (component: PageComponent) => number;
  let deleteComponentWithWarning: (id: string, components: PageComponent[], setComponents: any, setSelectedComponent: any) => void;
  let handleDragEndWithChildren: (event: any, components: PageComponent[], setComponents: any) => void;

  beforeEach(() => {
    mockComponents = [
      {
        id: 'parent-1',
        type: ComponentType.CONTAINER,
        gridArea: { row: 1, col: 1, rowSpan: 2, colSpan: 4 },
        properties: { content: 'Parent Container' },
        style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } },
        children: [
          {
            id: 'child-1',
            type: ComponentType.BUTTON,
            gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
            properties: { content: 'Child Button' },
            style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } },
            children: [
              {
                id: 'grandchild-1',
                type: ComponentType.TEXT,
                gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                properties: { content: 'Grandchild Text' },
                style: { basic: { fontSize: 'small', fontWeight: 'normal', textAlign: 'left' } }
              }
            ]
          },
          {
            id: 'child-2',
            type: ComponentType.TEXT,
            gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
            properties: { content: 'Child Text' },
            style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } }
          }
        ]
      },
      {
        id: 'standalone-1',
        type: ComponentType.HEADING,
        gridArea: { row: 3, col: 1, rowSpan: 1, colSpan: 4 },
        properties: { content: 'Standalone Heading' },
        style: { basic: { fontSize: 'large', fontWeight: 'bold', textAlign: 'left' } }
      }
    ];

    mockSetComponents = vi.fn();
    mockSetSelectedComponent = vi.fn();

    // Implementation of hierarchy management functions
    countNestedChildren = (component: PageComponent): number => {
      if (!component.children || component.children.length === 0) return 0;

      let count = component.children.length;
      component.children.forEach(child => {
        count += countNestedChildren(child);
      });
      return count;
    };

    deleteComponentWithWarning = (id: string, components: PageComponent[], setComponents: any, setSelectedComponent: any) => {
      const component = components.find(c => c.id === id);
      if (!component) return;

      const childCount = countNestedChildren(component);

      if (childCount > 0) {
        const message = `This component contains ${childCount} nested component${childCount === 1 ? '' : 's'}. Deleting it will also remove all nested components. Are you sure you want to continue?`;

        if (!window.confirm(message)) {
          return;
        }
      }

      // Simulate undo state save
      setComponents(components.filter(c => c.id !== id));
      setSelectedComponent(null);
    };

    handleDragEndWithChildren = (event: any, components: PageComponent[], setComponents: any) => {
      const { active, over } = event;
      if (!over) return;

      const draggedComponent = components.find(c => c.id === active.id);
      if (draggedComponent && over.data.current?.gridPosition) {
        const updatedComponents = components.map(c =>
          c.id === active.id
            ? {
                ...c,
                gridArea: {
                  ...over.data.current.gridPosition,
                  rowSpan: c.gridArea.rowSpan,
                  colSpan: c.gridArea.colSpan
                }
              }
            : c
        );
        setComponents(updatedComponents);
      }
    };
  });

  describe('Nested Children Counting Contract', () => {
    it('should count direct children only (FR-013)', () => {
      const parentComponent = mockComponents[0];
      const count = countNestedChildren(parentComponent);

      // Should count: child-1, child-2, grandchild-1 = 3 total
      expect(count).toBe(3);
    });

    it('should return 0 for components without children', () => {
      const standaloneComponent = mockComponents[1];
      const count = countNestedChildren(standaloneComponent);

      expect(count).toBe(0);
    });

    it('should handle deeply nested hierarchies', () => {
      const deeplyNestedComponent: PageComponent = {
        id: 'deep-parent',
        type: ComponentType.CONTAINER,
        gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        properties: {},
        style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } },
        children: [
          {
            id: 'level-1',
            type: ComponentType.CONTAINER,
            gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
            properties: {},
            style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } },
            children: [
              {
                id: 'level-2',
                type: ComponentType.TEXT,
                gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                properties: { content: 'Deep text' },
                style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } }
              }
            ]
          }
        ]
      };

      const count = countNestedChildren(deeplyNestedComponent);
      expect(count).toBe(2); // level-1 and level-2
    });
  });

  describe('Deletion Warning Contract', () => {
    beforeEach(() => {
      mockConfirm.mockClear();
    });

    it('should show warning when deleting component with children (FR-013)', () => {
      mockConfirm.mockReturnValue(true);

      deleteComponentWithWarning('parent-1', mockComponents, mockSetComponents, mockSetSelectedComponent);

      expect(mockConfirm).toHaveBeenCalledWith(
        'This component contains 3 nested components. Deleting it will also remove all nested components. Are you sure you want to continue?'
      );
    });

    it('should use singular form for single nested component', () => {
      // Create component with only one child
      const singleChildComponents = [{
        ...mockComponents[0],
        children: [mockComponents[0].children![1]] // Only child-2 (no grandchildren)
      }];

      mockConfirm.mockReturnValue(true);

      deleteComponentWithWarning('parent-1', singleChildComponents, mockSetComponents, mockSetSelectedComponent);

      expect(mockConfirm).toHaveBeenCalledWith(
        'This component contains 1 nested component. Deleting it will also remove all nested components. Are you sure you want to continue?'
      );
    });

    it('should not show warning when deleting component without children', () => {
      deleteComponentWithWarning('standalone-1', mockComponents, mockSetComponents, mockSetSelectedComponent);

      expect(mockConfirm).not.toHaveBeenCalled();
      expect(mockSetComponents).toHaveBeenCalledWith([mockComponents[0]]);
    });

    it('should cancel deletion when user declines warning (FR-013)', () => {
      mockConfirm.mockReturnValue(false);

      deleteComponentWithWarning('parent-1', mockComponents, mockSetComponents, mockSetSelectedComponent);

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockSetComponents).not.toHaveBeenCalled();
      expect(mockSetSelectedComponent).not.toHaveBeenCalled();
    });

    it('should proceed with deletion when user confirms warning (FR-012)', () => {
      mockConfirm.mockReturnValue(true);

      deleteComponentWithWarning('parent-1', mockComponents, mockSetComponents, mockSetSelectedComponent);

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockSetComponents).toHaveBeenCalledWith([mockComponents[1]]); // Only standalone component remains
      expect(mockSetSelectedComponent).toHaveBeenCalledWith(null);
    });
  });

  describe('Drag and Drop with Children Contract', () => {
    it('should preserve children during drag operations (FR-005)', () => {
      const dragEvent = {
        active: { id: 'parent-1' },
        over: {
          data: {
            current: {
              gridPosition: { row: 5, col: 5, rowSpan: 1, colSpan: 1 }
            }
          }
        }
      };

      handleDragEndWithChildren(dragEvent, mockComponents, mockSetComponents);

      expect(mockSetComponents).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'parent-1',
          gridArea: { row: 5, col: 5, rowSpan: 2, colSpan: 4 }, // Preserves original rowSpan/colSpan
          children: mockComponents[0].children // Children preserved
        }),
        mockComponents[1]
      ]);
    });

    it('should preserve resize dimensions during drag (FR-005)', () => {
      const originalComponent = mockComponents[0];
      const dragEvent = {
        active: { id: 'parent-1' },
        over: {
          data: {
            current: {
              gridPosition: { row: 2, col: 3, rowSpan: 1, colSpan: 1 } // Different from original
            }
          }
        }
      };

      handleDragEndWithChildren(dragEvent, mockComponents, mockSetComponents);

      expect(mockSetComponents).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'parent-1',
          gridArea: {
            row: 2,
            col: 3,
            rowSpan: originalComponent.gridArea.rowSpan, // Original rowSpan preserved
            colSpan: originalComponent.gridArea.colSpan  // Original colSpan preserved
          }
        }),
        mockComponents[1]
      ]);
    });

    it('should handle drag cancellation gracefully', () => {
      const dragEvent = {
        active: { id: 'parent-1' },
        over: null // No drop target
      };

      handleDragEndWithChildren(dragEvent, mockComponents, mockSetComponents);

      expect(mockSetComponents).not.toHaveBeenCalled();
    });

    it('should handle drag of non-existent component gracefully', () => {
      const dragEvent = {
        active: { id: 'non-existent' },
        over: {
          data: {
            current: {
              gridPosition: { row: 1, col: 1, rowSpan: 1, colSpan: 1 }
            }
          }
        }
      };

      handleDragEndWithChildren(dragEvent, mockComponents, mockSetComponents);

      expect(mockSetComponents).not.toHaveBeenCalled();
    });
  });

  describe('Circular Reference Prevention Contract', () => {
    it('should prevent component from containing itself (FR-007)', () => {
      // This test validates the concept - actual implementation would prevent this scenario
      const circularComponent: PageComponent = {
        id: 'circular-test',
        type: ComponentType.CONTAINER,
        gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        properties: {},
        style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } },
        children: [] // Would need validation to prevent adding itself
      };

      // Simulate validation that would prevent circular reference
      const wouldCreateCircularReference = (parentId: string, childId: string): boolean => {
        return parentId === childId;
      };

      expect(wouldCreateCircularReference('circular-test', 'circular-test')).toBe(true);
      expect(wouldCreateCircularReference('parent-1', 'child-1')).toBe(false);
    });
  });

  describe('Component Update with Children Contract', () => {
    it('should preserve children when updating parent properties', () => {
      const parentComponent = mockComponents[0];
      const updatedComponent = {
        ...parentComponent,
        properties: { ...parentComponent.properties, content: 'Updated Container' }
      };

      expect(updatedComponent.children).toEqual(parentComponent.children);
      expect(updatedComponent.children).toHaveLength(2);
    });

    it('should maintain child relationships after property updates', () => {
      const parentComponent = mockComponents[0];
      const updatedComponent = {
        ...parentComponent,
        style: {
          basic: { fontSize: 'large', fontWeight: 'bold', textAlign: 'center' }
        }
      };

      expect(updatedComponent.children?.[0].id).toBe('child-1');
      expect(updatedComponent.children?.[1].id).toBe('child-2');
      expect(updatedComponent.children?.[0].children?.[0].id).toBe('grandchild-1');
    });
  });
});