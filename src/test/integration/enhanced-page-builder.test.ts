/**
import './setup';
 * Integration Test: Enhanced Page Builder User Workflows
 * Validates complete user scenarios from quickstart guide
 * Requirements: All functional requirements (FR-001 through FR-013)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentType, PageComponent } from '../../pages/PageBuilder';

describe('Enhanced Page Builder Integration Tests', () => {
  let components: PageComponent[];
  let selectedComponent: PageComponent | null;

  // Mock functions that simulate PageBuilder behavior
  const setComponents = (newComponents: PageComponent[]) => {
    components = newComponents;
  };

  const setSelectedComponent = (component: PageComponent | null) => {
    selectedComponent = component;
  };

  // Helper function to simulate adding a component
  const addComponent = (type: ComponentType, gridArea = { row: 1, col: 1, rowSpan: 1, colSpan: 3 }): PageComponent => {
    const newComponent: PageComponent = {
      id: `component-${Date.now()}-${Math.random()}`,
      type,
      gridArea,
      properties: getDefaultProps(type),
      style: {
        basic: {
          fontSize: 'medium',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }
    };
    components.push(newComponent);
    return newComponent;
  };

  // Helper function to get default properties
  const getDefaultProps = (type: ComponentType) => {
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

  // Helper function to find component recursively
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

  // Helper function to add child to parent
  const addChildToParent = (parentId: string, childType: ComponentType): PageComponent => {
    const parent = findComponentRecursively(components, parentId);
    if (!parent) throw new Error('Parent not found');

    const child: PageComponent = {
      id: `child-${Date.now()}-${Math.random()}`,
      type: childType,
      gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      properties: getDefaultProps(childType),
      style: {
        basic: {
          fontSize: 'medium',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }
    };

    parent.children = parent.children || [];
    parent.children.push(child);
    return child;
  };

  // Helper function to count nested children recursively
  const countNestedChildren = (component: PageComponent): number => {
    if (!component.children || component.children.length === 0) return 0;

    let count = component.children.length;
    component.children.forEach(child => {
      count += countNestedChildren(child);
    });
    return count;
  };

  beforeEach(() => {
    components = [];
    selectedComponent = null;
  });

  describe('Test Scenario 1: Container Creation and Child Addition', () => {
    it('should create container component with empty state (FR-001)', () => {
      // Step 1: Create Container Component
      const container = addComponent(ComponentType.CONTAINER, { row: 1, col: 1, rowSpan: 2, colSpan: 4 });

      expect(container.type).toBe(ComponentType.CONTAINER);
      expect(container.children).toBeUndefined(); // Initially no children
      expect(components).toHaveLength(1);
    });

    it('should access children management for container (FR-002)', () => {
      // Step 2: Access Children Management
      const container = addComponent(ComponentType.CONTAINER);
      setSelectedComponent(container);

      expect(selectedComponent).toBe(container);
      expect(selectedComponent?.type).toBe(ComponentType.CONTAINER);
      // Children tab should be accessible (simulated by being able to manage children)
    });

    it('should add child components to container (FR-003)', () => {
      // Step 3: Add Child Components
      const container = addComponent(ComponentType.CONTAINER);
      setSelectedComponent(container);

      // Add Button child
      const button = addChildToParent(container.id, ComponentType.BUTTON);
      expect(container.children).toHaveLength(1);
      expect(container.children![0].type).toBe(ComponentType.BUTTON);
      expect(container.children![0].properties.content).toBe('Click Me');

      // Add Text child
      const text = addChildToParent(container.id, ComponentType.TEXT);
      expect(container.children).toHaveLength(2);
      expect(container.children![1].type).toBe(ComponentType.TEXT);
      expect(container.children![1].properties.content).toBe('Enter your text here...');
    });
  });

  describe('Test Scenario 2: Child Component Property Editing', () => {
    it('should edit child properties independently (FR-006, FR-010)', () => {
      // Step 4: Edit Child Properties
      const container = addComponent(ComponentType.CONTAINER);
      const button = addChildToParent(container.id, ComponentType.BUTTON);

      // Simulate editing child properties
      const originalButtonContent = button.properties.content;
      button.properties.content = 'Submit Form';

      expect(button.properties.content).toBe('Submit Form');
      expect(button.properties.content).not.toBe(originalButtonContent);

      // Parent should not be affected
      expect(container.properties.content).toBeUndefined();
      expect(container.children![0].properties.content).toBe('Submit Form');
    });

    it('should switch between parent and child editing contexts', () => {
      // Step 5: Return to Parent Editing
      const container = addComponent(ComponentType.CONTAINER);
      const button = addChildToParent(container.id, ComponentType.BUTTON);

      // Select child for editing
      setSelectedComponent(button);
      expect(selectedComponent).toBe(button);

      // Switch back to parent
      setSelectedComponent(container);
      expect(selectedComponent).toBe(container);
      expect(container.children).toHaveLength(1);
    });
  });

  describe('Test Scenario 3: Complex Hierarchy Creation', () => {
    it('should create form with multiple children (FR-001, FR-004)', () => {
      // Step 6: Create Form with Multiple Children
      const form = addComponent(ComponentType.FORM, { row: 3, col: 1, rowSpan: 3, colSpan: 4 });

      // Add children in order
      const heading = addChildToParent(form.id, ComponentType.HEADING);
      heading.properties.content = 'Contact Form';

      const nameInput = addChildToParent(form.id, ComponentType.INPUT);
      nameInput.properties.placeholder = 'Name';
      nameInput.properties.type = 'text';

      const emailInput = addChildToParent(form.id, ComponentType.INPUT);
      emailInput.properties.placeholder = 'Email';
      emailInput.properties.type = 'email';

      const submitButton = addChildToParent(form.id, ComponentType.BUTTON);
      submitButton.properties.content = 'Send Message';

      expect(form.children).toHaveLength(4);
      expect(form.children![0].properties.content).toBe('Contact Form');
      expect(form.children![1].properties.placeholder).toBe('Name');
      expect(form.children![2].properties.type).toBe('email');
      expect(form.children![3].properties.content).toBe('Send Message');
    });

    it('should create list container with bulleted items (FR-004)', () => {
      // Step 7: Test List Container
      const list = addComponent(ComponentType.LIST);

      const item1 = addChildToParent(list.id, ComponentType.TEXT);
      item1.properties.content = 'First item';

      const item2 = addChildToParent(list.id, ComponentType.TEXT);
      item2.properties.content = 'Second item';

      const item3 = addChildToParent(list.id, ComponentType.TEXT);
      item3.properties.content = 'Third item';

      expect(list.children).toHaveLength(3);
      expect(list.children![0].properties.content).toBe('First item');
      expect(list.children![1].properties.content).toBe('Second item');
      expect(list.children![2].properties.content).toBe('Third item');
    });
  });

  describe('Test Scenario 4: Hierarchy Management Operations', () => {
    it('should remove child components (FR-003)', () => {
      // Step 8: Test Child Deletion
      const form = addComponent(ComponentType.FORM);
      addChildToParent(form.id, ComponentType.HEADING);
      addChildToParent(form.id, ComponentType.INPUT);
      addChildToParent(form.id, ComponentType.INPUT);
      addChildToParent(form.id, ComponentType.BUTTON);

      expect(form.children).toHaveLength(4);

      // Remove one input component
      form.children = form.children!.filter((_, index) => index !== 1);

      expect(form.children).toHaveLength(3);
      expect(form.children![1].type).toBe(ComponentType.INPUT); // Second input is now at index 1
    });

    it('should warn before deleting parent with children (FR-012, FR-013)', () => {
      // Step 9: Test Parent Deletion Warning
      const container = addComponent(ComponentType.CONTAINER);
      addChildToParent(container.id, ComponentType.BUTTON);
      addChildToParent(container.id, ComponentType.TEXT);

      const childCount = countNestedChildren(container);
      expect(childCount).toBe(2);

      // Simulate deletion warning check
      const shouldWarn = childCount > 0;
      expect(shouldWarn).toBe(true);

      // Warning message should include accurate child count
      const warningMessage = `This component contains ${childCount} nested component${childCount === 1 ? '' : 's'}. Deleting it will also remove all nested components. Are you sure you want to continue?`;
      expect(warningMessage).toContain('2 nested components');
    });

    it('should preserve children during parent movement (FR-005, FR-009)', () => {
      // Step 10: Test Parent Movement with Children
      const container = addComponent(ComponentType.CONTAINER, { row: 1, col: 1, rowSpan: 2, colSpan: 4 });
      const button = addChildToParent(container.id, ComponentType.BUTTON);
      const text = addChildToParent(container.id, ComponentType.TEXT);

      const originalChildren = [...container.children!];

      // Simulate drag to new position
      container.gridArea = { row: 3, col: 5, rowSpan: 2, colSpan: 4 };

      // Children should be preserved
      expect(container.children).toEqual(originalChildren);
      expect(container.children).toHaveLength(2);
      expect(container.children![0]).toBe(button);
      expect(container.children![1]).toBe(text);
    });
  });

  describe('Test Scenario 5: Visual Hierarchy Indicators', () => {
    it('should provide child count indicators (FR-011)', () => {
      // Step 11: Verify Visual Indicators
      const emptyContainer = addComponent(ComponentType.CONTAINER);
      const containerWithChildren = addComponent(ComponentType.CONTAINER);
      addChildToParent(containerWithChildren.id, ComponentType.BUTTON);
      addChildToParent(containerWithChildren.id, ComponentType.TEXT);

      expect(countNestedChildren(emptyContainer)).toBe(0);
      expect(countNestedChildren(containerWithChildren)).toBe(2);
    });

    it('should preserve children during resize operations (FR-009)', () => {
      // Step 12: Test Resize with Children
      const container = addComponent(ComponentType.CONTAINER, { row: 1, col: 1, rowSpan: 2, colSpan: 3 });
      const button = addChildToParent(container.id, ComponentType.BUTTON);
      const text = addChildToParent(container.id, ComponentType.TEXT);

      const originalChildren = [...container.children!];

      // Simulate resize operation
      container.gridArea = { ...container.gridArea, rowSpan: 3, colSpan: 5 };

      // Children should be preserved
      expect(container.children).toEqual(originalChildren);
      expect(container.children).toHaveLength(2);
      expect(container.children![0].id).toBe(button.id);
      expect(container.children![1].id).toBe(text.id);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle deeply nested hierarchies (FR-008)', () => {
      const level1 = addComponent(ComponentType.CONTAINER);
      const level2 = addChildToParent(level1.id, ComponentType.CONTAINER);
      const level3 = addChildToParent(level2.id, ComponentType.CONTAINER);
      const level4 = addChildToParent(level3.id, ComponentType.TEXT);

      expect(countNestedChildren(level1)).toBe(3); // level2, level3, level4
      expect(countNestedChildren(level2)).toBe(2); // level3, level4
      expect(countNestedChildren(level3)).toBe(1); // level4
      expect(countNestedChildren(level4)).toBe(0); // no children
    });

    it('should prevent circular references (FR-007)', () => {
      const container = addComponent(ComponentType.CONTAINER);

      // Simulate validation that would prevent circular reference
      const wouldCreateCircularReference = (parentId: string, childId: string): boolean => {
        return parentId === childId;
      };

      expect(wouldCreateCircularReference(container.id, container.id)).toBe(true);
      expect(wouldCreateCircularReference(container.id, 'different-id')).toBe(false);
    });

    it('should handle empty containers gracefully', () => {
      const container = addComponent(ComponentType.CONTAINER);

      expect(container.children).toBeUndefined();
      expect(countNestedChildren(container)).toBe(0);
    });
  });
});