/**
 * Unit Tests: Hierarchy Management Utilities
 * Tests individual utility functions for component hierarchy operations
 */

import { describe, it, expect } from 'vitest';
import { ComponentType, PageComponent } from '../../pages/PageBuilder';

describe('Hierarchy Management Utilities', () => {
  // Mock data for testing
  const createMockComponent = (
    id: string,
    type: ComponentType,
    children?: PageComponent[]
  ): PageComponent => ({
    id,
    type,
    gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    properties: { content: `Mock ${type}` },
    style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } },
    children
  });

  describe('countNestedChildren utility', () => {
    const countNestedChildren = (component: PageComponent): number => {
      if (!component.children || component.children.length === 0) return 0;

      let count = component.children.length;
      component.children.forEach(child => {
        count += countNestedChildren(child);
      });
      return count;
    };

    it('should return 0 for component without children', () => {
      const component = createMockComponent('test-1', ComponentType.BUTTON);
      expect(countNestedChildren(component)).toBe(0);
    });

    it('should count direct children only', () => {
      const child1 = createMockComponent('child-1', ComponentType.TEXT);
      const child2 = createMockComponent('child-2', ComponentType.BUTTON);
      const parent = createMockComponent('parent', ComponentType.CONTAINER, [child1, child2]);

      expect(countNestedChildren(parent)).toBe(2);
    });

    it('should count nested children recursively', () => {
      const grandchild = createMockComponent('grandchild', ComponentType.TEXT);
      const child = createMockComponent('child', ComponentType.CONTAINER, [grandchild]);
      const parent = createMockComponent('parent', ComponentType.CONTAINER, [child]);

      expect(countNestedChildren(parent)).toBe(2); // child + grandchild
    });

    it('should handle complex nested structures', () => {
      const gc1 = createMockComponent('gc1', ComponentType.TEXT);
      const gc2 = createMockComponent('gc2', ComponentType.BUTTON);
      const gc3 = createMockComponent('gc3', ComponentType.INPUT);

      const child1 = createMockComponent('child1', ComponentType.FORM, [gc1, gc2]);
      const child2 = createMockComponent('child2', ComponentType.LIST, [gc3]);
      const child3 = createMockComponent('child3', ComponentType.TEXT);

      const parent = createMockComponent('parent', ComponentType.CONTAINER, [child1, child2, child3]);

      expect(countNestedChildren(parent)).toBe(6); // child1, child2, child3, gc1, gc2, gc3
    });

    it('should handle empty children array', () => {
      const component = createMockComponent('test', ComponentType.CONTAINER, []);
      expect(countNestedChildren(component)).toBe(0);
    });
  });

  describe('findComponentRecursively utility', () => {
    const findComponentRecursively = (components: PageComponent[], id: string): PageComponent | null => {
      for (const component of components) {
        if (component.id === id) return component;
        if (component.children) {
          const found = findComponentRecursively(component.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    it('should find component at root level', () => {
      const comp1 = createMockComponent('comp1', ComponentType.BUTTON);
      const comp2 = createMockComponent('comp2', ComponentType.TEXT);
      const components = [comp1, comp2];

      const found = findComponentRecursively(components, 'comp2');
      expect(found).toBe(comp2);
    });

    it('should find component in nested children', () => {
      const grandchild = createMockComponent('grandchild', ComponentType.TEXT);
      const child = createMockComponent('child', ComponentType.CONTAINER, [grandchild]);
      const parent = createMockComponent('parent', ComponentType.CONTAINER, [child]);
      const components = [parent];

      const found = findComponentRecursively(components, 'grandchild');
      expect(found).toBe(grandchild);
    });

    it('should return null for non-existent component', () => {
      const comp1 = createMockComponent('comp1', ComponentType.BUTTON);
      const components = [comp1];

      const found = findComponentRecursively(components, 'non-existent');
      expect(found).toBeNull();
    });

    it('should find component in complex hierarchy', () => {
      const target = createMockComponent('target', ComponentType.INPUT);
      const sibling = createMockComponent('sibling', ComponentType.TEXT);
      const child = createMockComponent('child', ComponentType.FORM, [target, sibling]);
      const parent1 = createMockComponent('parent1', ComponentType.CONTAINER, [child]);
      const parent2 = createMockComponent('parent2', ComponentType.LIST);
      const components = [parent1, parent2];

      const found = findComponentRecursively(components, 'target');
      expect(found).toBe(target);
    });
  });

  describe('validateCircularReference utility', () => {
    const validateCircularReference = (parentId: string, childId: string): boolean => {
      return parentId === childId;
    };

    it('should detect circular reference when parent and child are same', () => {
      expect(validateCircularReference('comp1', 'comp1')).toBe(true);
    });

    it('should allow valid parent-child relationships', () => {
      expect(validateCircularReference('parent', 'child')).toBe(false);
    });
  });

  describe('getDefaultPropsForType utility', () => {
    const getDefaultPropsForType = (type: ComponentType) => {
      switch (type) {
        case ComponentType.HEADING:
          return { content: 'New Heading' };
        case ComponentType.TEXT:
        case ComponentType.PARAGRAPH:
          return { content: 'Enter your text here...' };
        case ComponentType.BUTTON:
          return { content: 'Click Me' };
        case ComponentType.LINK:
          return { content: 'Link Text', href: '#' };
        case ComponentType.INPUT:
          return { placeholder: 'Enter text...', type: 'text' };
        case ComponentType.IMAGE:
          return { alt: 'Image', src: '/placeholder.jpg' };
        default:
          return {};
      }
    };

    it('should return correct default props for HEADING', () => {
      const props = getDefaultPropsForType(ComponentType.HEADING);
      expect(props).toEqual({ content: 'New Heading' });
    });

    it('should return correct default props for BUTTON', () => {
      const props = getDefaultPropsForType(ComponentType.BUTTON);
      expect(props).toEqual({ content: 'Click Me' });
    });

    it('should return correct default props for INPUT', () => {
      const props = getDefaultPropsForType(ComponentType.INPUT);
      expect(props).toEqual({ placeholder: 'Enter text...', type: 'text' });
    });

    it('should return correct default props for LINK', () => {
      const props = getDefaultPropsForType(ComponentType.LINK);
      expect(props).toEqual({ content: 'Link Text', href: '#' });
    });

    it('should return empty object for unknown types', () => {
      const props = getDefaultPropsForType('UNKNOWN' as ComponentType);
      expect(props).toEqual({});
    });
  });

  describe('generateDeletionWarningMessage utility', () => {
    const generateDeletionWarningMessage = (childCount: number): string => {
      return `This component contains ${childCount} nested component${childCount === 1 ? '' : 's'}. Deleting it will also remove all nested components. Are you sure you want to continue?`;
    };

    it('should generate correct message for single child', () => {
      const message = generateDeletionWarningMessage(1);
      expect(message).toBe('This component contains 1 nested component. Deleting it will also remove all nested components. Are you sure you want to continue?');
    });

    it('should generate correct message for multiple children', () => {
      const message = generateDeletionWarningMessage(3);
      expect(message).toBe('This component contains 3 nested components. Deleting it will also remove all nested components. Are you sure you want to continue?');
    });

    it('should handle zero children edge case', () => {
      const message = generateDeletionWarningMessage(0);
      expect(message).toBe('This component contains 0 nested components. Deleting it will also remove all nested components. Are you sure you want to continue?');
    });
  });

  describe('preserveGridDimensionsOnDrag utility', () => {
    const preserveGridDimensionsOnDrag = (
      originalGridArea: { row: number; col: number; rowSpan: number; colSpan: number },
      newPosition: { row: number; col: number; rowSpan: number; colSpan: number }
    ) => {
      return {
        row: newPosition.row,
        col: newPosition.col,
        rowSpan: originalGridArea.rowSpan,
        colSpan: originalGridArea.colSpan
      };
    };

    it('should preserve original rowSpan and colSpan', () => {
      const original = { row: 1, col: 1, rowSpan: 3, colSpan: 4 };
      const newPos = { row: 5, col: 6, rowSpan: 1, colSpan: 1 };

      const result = preserveGridDimensionsOnDrag(original, newPos);

      expect(result).toEqual({
        row: 5,
        col: 6,
        rowSpan: 3,
        colSpan: 4
      });
    });

    it('should update position while preserving size', () => {
      const original = { row: 2, col: 3, rowSpan: 2, colSpan: 5 };
      const newPos = { row: 8, col: 9, rowSpan: 1, colSpan: 1 };

      const result = preserveGridDimensionsOnDrag(original, newPos);

      expect(result.row).toBe(8);
      expect(result.col).toBe(9);
      expect(result.rowSpan).toBe(2);
      expect(result.colSpan).toBe(5);
    });
  });

  describe('validateHierarchyIntegrity utility', () => {
    const validateHierarchyIntegrity = (components: PageComponent[]): boolean => {
      const allIds = new Set<string>();

      const collectIds = (comps: PageComponent[]): boolean => {
        for (const comp of comps) {
          if (allIds.has(comp.id)) return false; // Duplicate ID
          allIds.add(comp.id);

          if (comp.children && !collectIds(comp.children)) return false;
        }
        return true;
      };

      return collectIds(components);
    };

    it('should validate hierarchy with unique IDs', () => {
      const child = createMockComponent('child', ComponentType.TEXT);
      const parent = createMockComponent('parent', ComponentType.CONTAINER, [child]);
      const components = [parent];

      expect(validateHierarchyIntegrity(components)).toBe(true);
    });

    it('should detect duplicate IDs in hierarchy', () => {
      const child = createMockComponent('duplicate', ComponentType.TEXT);
      const parent = createMockComponent('duplicate', ComponentType.CONTAINER, [child]);
      const components = [parent];

      expect(validateHierarchyIntegrity(components)).toBe(false);
    });

    it('should validate complex hierarchy with multiple levels', () => {
      const gc1 = createMockComponent('gc1', ComponentType.TEXT);
      const gc2 = createMockComponent('gc2', ComponentType.BUTTON);
      const child1 = createMockComponent('child1', ComponentType.FORM, [gc1]);
      const child2 = createMockComponent('child2', ComponentType.LIST, [gc2]);
      const parent1 = createMockComponent('parent1', ComponentType.CONTAINER, [child1]);
      const parent2 = createMockComponent('parent2', ComponentType.CONTAINER, [child2]);
      const components = [parent1, parent2];

      expect(validateHierarchyIntegrity(components)).toBe(true);
    });
  });
});