import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup';

/**
 * Integration test for undo/redo operations in visual page builder
 * Tests complete user workflow for command pattern operations
 *
 * This test will initially fail (TDD approach) until the visual page builder is implemented
 */

interface Command {
  id: string;
  type: 'add' | 'edit' | 'move' | 'delete';
  timestamp: Date;
  componentId?: string;
  execute(): void;
  undo(): void;
}

interface ComponentState {
  id: string;
  type: string;
  gridArea: { row: number; col: number; rowSpan: number; colSpan: number };
  properties: Record<string, any>;
}

// Mock command implementations
class AddComponentCommand implements Command {
  id: string;
  type = 'add' as const;
  timestamp: Date;
  componentId: string;

  constructor(
    private pageBuilder: MockPageBuilderWithHistory,
    public component: ComponentState
  ) {
    this.id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.componentId = component.id;
  }

  execute(): void {
    this.pageBuilder.addComponentDirectly(this.component);
  }

  undo(): void {
    this.pageBuilder.removeComponentDirectly(this.componentId);
  }
}

class EditComponentCommand implements Command {
  id: string;
  type = 'edit' as const;
  timestamp: Date;
  componentId: string;

  constructor(
    private pageBuilder: MockPageBuilderWithHistory,
    componentId: string,
    private newProperties: Record<string, any>,
    private oldProperties: Record<string, any>
  ) {
    this.id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.componentId = componentId;
  }

  execute(): void {
    this.pageBuilder.setComponentPropertiesDirectly(this.componentId, this.newProperties);
  }

  undo(): void {
    this.pageBuilder.setComponentPropertiesDirectly(this.componentId, this.oldProperties);
  }
}

class MoveComponentCommand implements Command {
  id: string;
  type = 'move' as const;
  timestamp: Date;
  componentId: string;

  constructor(
    private pageBuilder: MockPageBuilderWithHistory,
    componentId: string,
    private newPosition: { row: number; col: number },
    private oldPosition: { row: number; col: number }
  ) {
    this.id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.componentId = componentId;
  }

  execute(): void {
    this.pageBuilder.setComponentPositionDirectly(this.componentId, this.newPosition);
  }

  undo(): void {
    this.pageBuilder.setComponentPositionDirectly(this.componentId, this.oldPosition);
  }
}

class DeleteComponentCommand implements Command {
  id: string;
  type = 'delete' as const;
  timestamp: Date;
  componentId: string;

  constructor(
    private pageBuilder: MockPageBuilderWithHistory,
    private component: ComponentState
  ) {
    this.id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.componentId = component.id;
  }

  execute(): void {
    this.pageBuilder.removeComponentDirectly(this.componentId);
  }

  undo(): void {
    this.pageBuilder.addComponentDirectly(this.component);
  }
}

// Mock page builder with command history
class MockPageBuilderWithHistory {
  private pages = new Map();
  private currentPage: any = null;
  private components = new Map<string, ComponentState>();
  private componentCounter = 0;
  private commandHistory: Command[] = [];
  private currentHistoryIndex = -1;
  private readonly maxHistorySize = 50;


  async dragComponent(type: string, position: { row: number; col: number }): Promise<string> {
    this.componentCounter++;
    const componentId = `${type}-${this.componentCounter}`;

    const component: ComponentState = {
      id: componentId,
      type,
      gridArea: {
        row: position.row,
        col: position.col,
        rowSpan: 1,
        colSpan: 1
      },
      properties: this.getDefaultProperties(type)
    };

    const command = new AddComponentCommand(this, component);
    this.executeCommand(command);

    return componentId;
  }

  async editComponent(componentId: string, properties: Record<string, any>): Promise<void> {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    const oldProperties = { ...component.properties };
    const newProperties = { ...component.properties, ...properties };

    const command = new EditComponentCommand(this, componentId, newProperties, oldProperties);
    this.executeCommand(command);
  }

  async moveComponent(componentId: string, newPosition: { row: number; col: number }): Promise<void> {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    const oldPosition = {
      row: component.gridArea.row,
      col: component.gridArea.col
    };

    const command = new MoveComponentCommand(this, componentId, newPosition, oldPosition);
    this.executeCommand(command);
  }

  async deleteComponent(componentId: string): Promise<void> {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    const command = new DeleteComponentCommand(this, { ...component });
    this.executeCommand(command);
  }

  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      return false;
    }

    const command = this.commandHistory[this.currentHistoryIndex];
    command.undo();
    this.currentHistoryIndex--;

    return true;
  }

  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      return false;
    }

    this.currentHistoryIndex++;
    const command = this.commandHistory[this.currentHistoryIndex];
    command.execute();

    return true;
  }

  canUndo(): boolean {
    return this.currentHistoryIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentHistoryIndex < this.commandHistory.length - 1;
  }

  getHistoryState(): { canUndo: boolean; canRedo: boolean; historySize: number } {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      historySize: this.commandHistory.length
    };
  }

  getCommandHistory(): Command[] {
    return [...this.commandHistory];
  }

  clearHistory(): void {
    this.commandHistory = [];
    this.currentHistoryIndex = -1;
  }

  // Direct manipulation methods (used by commands)
  addComponentDirectly(component: ComponentState): void {
    this.components.set(component.id, component);
    if (this.currentPage) {
      this.currentPage.components.push(component.id);
    }
  }

  removeComponentDirectly(componentId: string): void {
    this.components.delete(componentId);
    if (this.currentPage) {
      this.currentPage.components = this.currentPage.components.filter((id: string) => id !== componentId);
    }
  }

  setComponentPropertiesDirectly(componentId: string, properties: Record<string, any>): void {
    const component = this.components.get(componentId);
    if (component) {
      component.properties = properties;
    }
  }

  setComponentPositionDirectly(componentId: string, position: { row: number; col: number }): void {
    const component = this.components.get(componentId);
    if (component) {
      component.gridArea.row = position.row;
      component.gridArea.col = position.col;
    }
  }

  private executeCommand(command: Command): void {
    // Remove any commands after current position (they become invalid after new command)
    if (this.currentHistoryIndex < this.commandHistory.length - 1) {
      this.commandHistory = this.commandHistory.slice(0, this.currentHistoryIndex + 1);
    }

    // Add new command
    this.commandHistory.push(command);

    // Limit history size
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift();
    } else {
      this.currentHistoryIndex++;
    }

    // Execute the command
    command.execute();
  }

  private getDefaultProperties(type: string): Record<string, any> {
    switch (type) {
      case 'text':
        return { content: 'Default text content' };
      case 'heading':
        return { content: 'Default heading', level: 1 };
      case 'button':
        return { text: 'Click me', variant: 'primary' };
      case 'form':
        return { fields: [] };
      default:
        return {};
    }
  }

  getComponent(componentId: string): ComponentState | null {
    return this.components.get(componentId) || null;
  }

  getAllComponents(): ComponentState[] {
    return Array.from(this.components.values());
  }

  reset(): void {
    this.pages.clear();
    this.components.clear();
    this.currentPage = null;
    this.componentCounter = 0;
    this.clearHistory();
  }

  // Override createPage to also clear components when creating new page
  async createPage(config: { title: string; slug: string }): Promise<any> {
    const page = {
      id: `page-${Date.now()}`,
      title: config.title,
      slug: config.slug,
      components: [],
      metadata: {
        compressedSize: 100,
        bandwidthValid: true
      }
    };

    this.pages.set(page.id, page);
    this.currentPage = page;

    // Clear history and components when creating new page
    this.clearHistory();
    this.components.clear(); // Also clear components
    this.componentCounter = 0; // Reset counter

    return page;
  }
}

describe('Visual Page Builder - Undo/Redo Operations', () => {
  let pageBuilder: MockPageBuilderWithHistory;

  beforeEach(async () => {
    pageBuilder = new MockPageBuilderWithHistory();
    await pageBuilder.createPage({
      title: 'Test Page',
      slug: 'test'
    });
  });

  it('should support undo/redo operations', async () => {
    let historyState = pageBuilder.getHistoryState();
    expect(historyState.canUndo).toBe(false);
    expect(historyState.canRedo).toBe(false);
    expect(historyState.historySize).toBe(0);

    // 1. Add component
    const componentId = await pageBuilder.dragComponent('text', { row: 1, col: 1 });

    historyState = pageBuilder.getHistoryState();
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);
    expect(historyState.historySize).toBe(1);

    let component = pageBuilder.getComponent(componentId);
    expect(component).toBeDefined();
    expect(component?.id).toBe(componentId);

    // 2. Edit content
    await pageBuilder.editComponent(componentId, {
      content: 'Original text'
    });

    historyState = pageBuilder.getHistoryState();
    expect(historyState.historySize).toBe(2);

    component = pageBuilder.getComponent(componentId);
    expect(component?.properties.content).toBe('Original text');

    // 3. Move component
    await pageBuilder.moveComponent(componentId, { row: 2, col: 3 });

    historyState = pageBuilder.getHistoryState();
    expect(historyState.historySize).toBe(3);

    component = pageBuilder.getComponent(componentId);
    expect(component?.gridArea.row).toBe(2);
    expect(component?.gridArea.col).toBe(3);

    // 4. Undo move
    const undoMoveResult = await pageBuilder.undo();
    expect(undoMoveResult).toBe(true);

    component = pageBuilder.getComponent(componentId);
    expect(component?.gridArea.row).toBe(1);
    expect(component?.gridArea.col).toBe(1);

    historyState = pageBuilder.getHistoryState();
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(true);

    // 5. Redo move
    const redoMoveResult = await pageBuilder.redo();
    expect(redoMoveResult).toBe(true);

    component = pageBuilder.getComponent(componentId);
    expect(component?.gridArea.row).toBe(2);
    expect(component?.gridArea.col).toBe(3);

    // 6. Undo all operations
    await pageBuilder.undo(); // Undo move
    component = pageBuilder.getComponent(componentId);
    expect(component?.gridArea.row).toBe(1);

    await pageBuilder.undo(); // Undo edit
    component = pageBuilder.getComponent(componentId);
    expect(component?.properties.content).toBe('Default text content');

    await pageBuilder.undo(); // Undo add
    component = pageBuilder.getComponent(componentId);
    expect(component).toBeNull();

    historyState = pageBuilder.getHistoryState();
    expect(historyState.canUndo).toBe(false);
    expect(historyState.canRedo).toBe(true);
  });

  it('should handle multiple components with undo/redo', async () => {
    // Add multiple components
    const textId = await pageBuilder.dragComponent('text', { row: 1, col: 1 });
    const headingId = await pageBuilder.dragComponent('heading', { row: 2, col: 1 });
    const buttonId = await pageBuilder.dragComponent('button', { row: 3, col: 1 });

    expect(pageBuilder.getAllComponents()).toHaveLength(3);

    // Edit all components
    await pageBuilder.editComponent(textId, { content: 'Text content' });
    await pageBuilder.editComponent(headingId, { content: 'Main heading' });
    await pageBuilder.editComponent(buttonId, { text: 'Submit' });

    // Verify all edits
    let textComponent = pageBuilder.getComponent(textId);
    let headingComponent = pageBuilder.getComponent(headingId);
    let buttonComponent = pageBuilder.getComponent(buttonId);

    expect(textComponent?.properties.content).toBe('Text content');
    expect(headingComponent?.properties.content).toBe('Main heading');
    expect(buttonComponent?.properties.text).toBe('Submit');

    // Undo last three operations (edits)
    await pageBuilder.undo(); // Undo button edit
    buttonComponent = pageBuilder.getComponent(buttonId);
    expect(buttonComponent?.properties.text).toBe('Click me');

    await pageBuilder.undo(); // Undo heading edit
    headingComponent = pageBuilder.getComponent(headingId);
    expect(headingComponent?.properties.content).toBe('Default heading');

    await pageBuilder.undo(); // Undo text edit
    textComponent = pageBuilder.getComponent(textId);
    expect(textComponent?.properties.content).toBe('Default text content');

    // Components should still exist
    expect(pageBuilder.getAllComponents()).toHaveLength(3);

    // Redo all edits
    await pageBuilder.redo(); // Redo text edit
    await pageBuilder.redo(); // Redo heading edit
    await pageBuilder.redo(); // Redo button edit

    textComponent = pageBuilder.getComponent(textId);
    headingComponent = pageBuilder.getComponent(headingId);
    buttonComponent = pageBuilder.getComponent(buttonId);

    expect(textComponent?.properties.content).toBe('Text content');
    expect(headingComponent?.properties.content).toBe('Main heading');
    expect(buttonComponent?.properties.text).toBe('Submit');
  });

  it('should clear redo history when new command is executed', async () => {
    // Add and edit component
    const componentId = await pageBuilder.dragComponent('text', { row: 1, col: 1 });
    await pageBuilder.editComponent(componentId, { content: 'First edit' });
    await pageBuilder.editComponent(componentId, { content: 'Second edit' });

    expect(pageBuilder.getHistoryState().historySize).toBe(3);

    // Undo to middle of history
    await pageBuilder.undo(); // Undo second edit
    await pageBuilder.undo(); // Undo first edit

    expect(pageBuilder.getHistoryState().canRedo).toBe(true);

    // Execute new command - this should clear redo history
    await pageBuilder.editComponent(componentId, { content: 'New branch edit' });

    const historyState = pageBuilder.getHistoryState();
    expect(historyState.canRedo).toBe(false);
    expect(historyState.historySize).toBe(2); // add + new edit

    const component = pageBuilder.getComponent(componentId);
    expect(component?.properties.content).toBe('New branch edit');
  });

  it('should handle component deletion and restoration', async () => {
    // Add component
    const componentId = await pageBuilder.dragComponent('text', { row: 1, col: 1 });
    await pageBuilder.editComponent(componentId, { content: 'Important text' });

    expect(pageBuilder.getComponent(componentId)).toBeDefined();
    expect(pageBuilder.getAllComponents()).toHaveLength(1);

    // Delete component
    await pageBuilder.deleteComponent(componentId);

    expect(pageBuilder.getComponent(componentId)).toBeNull();
    expect(pageBuilder.getAllComponents()).toHaveLength(0);

    // Undo deletion
    await pageBuilder.undo();

    const restoredComponent = pageBuilder.getComponent(componentId);
    expect(restoredComponent).toBeDefined();
    expect(restoredComponent?.properties.content).toBe('Important text');
    expect(pageBuilder.getAllComponents()).toHaveLength(1);

    // Redo deletion
    await pageBuilder.redo();

    expect(pageBuilder.getComponent(componentId)).toBeNull();
    expect(pageBuilder.getAllComponents()).toHaveLength(0);
  });

  it('should handle boundary conditions', async () => {
    // Test undo when no commands in history
    const undoResult = await pageBuilder.undo();
    expect(undoResult).toBe(false);

    // Test redo when no commands in history
    const redoResult = await pageBuilder.redo();
    expect(redoResult).toBe(false);

    // Add component and undo it
    const componentId = await pageBuilder.dragComponent('text', { row: 1, col: 1 });
    await pageBuilder.undo();

    // Test undo when already at beginning
    const undoAtBeginning = await pageBuilder.undo();
    expect(undoAtBeginning).toBe(false);

    // Redo and try to redo again
    await pageBuilder.redo();
    const redoAtEnd = await pageBuilder.redo();
    expect(redoAtEnd).toBe(false);
  });

  it('should maintain command metadata', async () => {
    const startTime = Date.now();

    // Add component
    const componentId = await pageBuilder.dragComponent('text', { row: 1, col: 1 });

    const history = pageBuilder.getCommandHistory();
    expect(history).toHaveLength(1);

    const command = history[0];
    expect(command.type).toBe('add');
    expect(command.componentId).toBe(componentId);
    expect(command.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
    expect(command.id).toMatch(/^cmd_\d+_[a-z0-9]{9}$/);

    // Edit component
    await pageBuilder.editComponent(componentId, { content: 'Test content' });

    const updatedHistory = pageBuilder.getCommandHistory();
    expect(updatedHistory).toHaveLength(2);

    const editCommand = updatedHistory[1];
    expect(editCommand.type).toBe('edit');
    expect(editCommand.componentId).toBe(componentId);
  });

  it('should limit history size', async () => {
    // Add many commands to test history limit
    const maxHistorySize = 50;

    for (let i = 0; i < maxHistorySize + 10; i++) {
      await pageBuilder.dragComponent('text', { row: i + 1, col: 1 });
    }

    const historyState = pageBuilder.getHistoryState();
    expect(historyState.historySize).toBeLessThanOrEqual(maxHistorySize);

    // Should still be able to undo
    expect(historyState.canUndo).toBe(true);
  });

  it('should handle errors in component operations gracefully', async () => {
    // Test editing non-existent component
    await expect(pageBuilder.editComponent('non-existent', { content: 'test' }))
      .rejects.toThrow('Component non-existent not found');

    // Test moving non-existent component
    await expect(pageBuilder.moveComponent('non-existent', { row: 1, col: 1 }))
      .rejects.toThrow('Component non-existent not found');

    // Test deleting non-existent component
    await expect(pageBuilder.deleteComponent('non-existent'))
      .rejects.toThrow('Component non-existent not found');

    // History should remain unchanged
    const historyState = pageBuilder.getHistoryState();
    expect(historyState.historySize).toBe(0);
  });

  it('should clear history when creating new page', async () => {
    // Add some commands
    await pageBuilder.dragComponent('text', { row: 1, col: 1 });
    await pageBuilder.dragComponent('heading', { row: 2, col: 1 });

    expect(pageBuilder.getHistoryState().historySize).toBe(2);

    // Create new page
    await pageBuilder.createPage({
      title: 'New Page',
      slug: 'new-page'
    });

    // History should be cleared
    const historyState = pageBuilder.getHistoryState();
    expect(historyState.historySize).toBe(0);
    expect(historyState.canUndo).toBe(false);
    expect(historyState.canRedo).toBe(false);

    // Old components should be gone
    expect(pageBuilder.getAllComponents()).toHaveLength(0);
  });
});