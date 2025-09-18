import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Database } from '../../lib/database';
import { RadioJSXCompiler } from '../../lib/jsx-radio';
import { HamRadioCompressor } from '../../lib/compression';
import './setup';

/**
 * Integration test for undo/redo functionality in visual page builder
 * Tests complete state management and history tracking
 * Using REAL components, only mocking browser APIs
 */

interface Component {
  id: string;
  type: string;
  gridArea: { row: number; col: number; rowSpan: number; colSpan: number };
  properties: Record<string, any>;
}

interface PageState {
  components: Component[];
  selectedComponentId: string | null;
  metadata: {
    lastModified: number;
    version: number;
  };
}

interface HistoryEntry {
  state: PageState;
  description: string;
  timestamp: number;
}

class UndoRedoManager {
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;
  private database: Database;
  private jsxCompiler: RadioJSXCompiler;
  private compressor: HamRadioCompressor;

  constructor(database: Database, jsxCompiler: RadioJSXCompiler, compressor: HamRadioCompressor) {
    this.database = database;
    this.jsxCompiler = jsxCompiler;
    this.compressor = compressor;
  }

  pushState(state: PageState, description: string): void {
    // Remove any states after current index (for branching history)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new state
    this.history.push({
      state: this.cloneState(state),
      description,
      timestamp: Date.now()
    });

    // Maintain max history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  undo(): PageState | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    return this.cloneState(this.history[this.currentIndex].state);
  }

  redo(): PageState | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    return this.cloneState(this.history[this.currentIndex].state);
  }

  getCurrentState(): PageState | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.cloneState(this.history[this.currentIndex].state);
  }

  getHistory(): HistoryEntry[] {
    return this.history.map(entry => ({
      ...entry,
      state: this.cloneState(entry.state)
    }));
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  private cloneState(state: PageState): PageState {
    return JSON.parse(JSON.stringify(state));
  }

  async saveCheckpoint(slug: string): Promise<void> {
    const currentState = this.getCurrentState();
    if (!currentState) return;

    // Compile and compress state with real components
    const jsxStructure = {
      type: 'div',
      props: {},
      children: currentState.components.map(c => ({
        type: c.type.toLowerCase(),
        props: c.properties,
        children: []
      }))
    };

    const compiled = this.jsxCompiler.compile(jsxStructure);
    const compressed = this.compressor.compress(JSON.stringify({
      state: currentState,
      history: this.history
    }));

    await this.database.savePage({
      slug: `${slug}-checkpoint-${Date.now()}`,
      content: JSON.stringify(currentState),
      compressed: compressed
    });
  }
}

describe('Visual Page Builder - Undo/Redo (Real Components)', () => {
  let undoRedoManager: UndoRedoManager;
  let database: Database;
  let jsxCompiler: RadioJSXCompiler;
  let compressor: HamRadioCompressor;
  let currentState: PageState;

  beforeEach(async () => {
    // Use real components
    database = new Database();
    jsxCompiler = new RadioJSXCompiler();
    compressor = new HamRadioCompressor();

    // Initialize database
    await database.init();

    // Create undo/redo manager with real components
    undoRedoManager = new UndoRedoManager(database, jsxCompiler, compressor);

    // Initial state
    currentState = {
      components: [],
      selectedComponentId: null,
      metadata: {
        lastModified: Date.now(),
        version: 1
      }
    };

    // Push initial state
    undoRedoManager.pushState(currentState, 'Initial state');
  });

  describe('Basic Undo/Redo Operations', () => {
    it('should track component additions', () => {
      // Add first component
      const heading: Component = {
        id: 'h1',
        type: 'HEADING',
        gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
        properties: { text: 'Welcome', level: 1 }
      };

      currentState.components.push(heading);
      currentState.metadata.lastModified = Date.now();
      undoRedoManager.pushState(currentState, 'Add heading');

      // Add second component
      const paragraph: Component = {
        id: 'p1',
        type: 'PARAGRAPH',
        gridArea: { row: 1, col: 0, rowSpan: 2, colSpan: 12 },
        properties: { text: 'Hello World' }
      };

      currentState.components.push(paragraph);
      currentState.metadata.lastModified = Date.now();
      undoRedoManager.pushState(currentState, 'Add paragraph');

      expect(currentState.components).toHaveLength(2);

      // Undo last action
      const previousState = undoRedoManager.undo();
      expect(previousState).toBeDefined();
      expect(previousState!.components).toHaveLength(1);
      expect(previousState!.components[0].id).toBe('h1');

      // Redo
      const redoState = undoRedoManager.redo();
      expect(redoState).toBeDefined();
      expect(redoState!.components).toHaveLength(2);
    });

    it('should track component deletions', () => {
      // Setup initial components
      currentState.components = [
        {
          id: 'c1',
          type: 'HEADING',
          gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
          properties: { text: 'Title' }
        },
        {
          id: 'c2',
          type: 'PARAGRAPH',
          gridArea: { row: 1, col: 0, rowSpan: 1, colSpan: 12 },
          properties: { text: 'Content' }
        }
      ];
      undoRedoManager.pushState(currentState, 'Initial components');

      // Delete a component
      currentState.components = currentState.components.filter(c => c.id !== 'c2');
      currentState.metadata.lastModified = Date.now();
      undoRedoManager.pushState(currentState, 'Delete paragraph');

      expect(currentState.components).toHaveLength(1);

      // Undo deletion
      const undoState = undoRedoManager.undo();
      expect(undoState!.components).toHaveLength(2);
      expect(undoState!.components.find(c => c.id === 'c2')).toBeDefined();
    });

    it('should track property modifications', () => {
      const button: Component = {
        id: 'btn1',
        type: 'BUTTON',
        gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 4 },
        properties: { text: 'Click Me', action: '/action' }
      };

      currentState.components = [button];
      undoRedoManager.pushState(currentState, 'Add button');

      // Modify button text
      currentState.components[0].properties.text = 'Submit';
      currentState.metadata.lastModified = Date.now();
      undoRedoManager.pushState(currentState, 'Change button text');

      // Modify button action
      currentState.components[0].properties.action = '/submit';
      currentState.metadata.lastModified = Date.now();
      undoRedoManager.pushState(currentState, 'Change button action');

      // Undo twice
      undoRedoManager.undo();
      const state = undoRedoManager.undo();

      expect(state!.components[0].properties.text).toBe('Click Me');
      expect(state!.components[0].properties.action).toBe('/action');
    });
  });

  describe('Complex State Changes', () => {
    it('should handle multiple component moves', () => {
      const comp1: Component = {
        id: 'comp1',
        type: 'TEXT',
        gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 6 },
        properties: { text: 'Left' }
      };

      const comp2: Component = {
        id: 'comp2',
        type: 'TEXT',
        gridArea: { row: 0, col: 6, rowSpan: 1, colSpan: 6 },
        properties: { text: 'Right' }
      };

      currentState.components = [comp1, comp2];
      undoRedoManager.pushState(currentState, 'Initial layout');

      // Move comp1 to the right
      currentState.components[0].gridArea.col = 8;
      undoRedoManager.pushState(currentState, 'Move comp1 right');

      // Move comp2 to the left
      currentState.components[1].gridArea.col = 0;
      undoRedoManager.pushState(currentState, 'Move comp2 left');

      // Verify current positions
      expect(currentState.components[0].gridArea.col).toBe(8);
      expect(currentState.components[1].gridArea.col).toBe(0);

      // Undo both moves
      undoRedoManager.undo();
      const state = undoRedoManager.undo();

      expect(state!.components[0].gridArea.col).toBe(0);
      expect(state!.components[1].gridArea.col).toBe(6);
    });

    it('should handle bulk operations', () => {
      // Add multiple components at once
      const bulkComponents: Component[] = [
        {
          id: 'b1',
          type: 'HEADING',
          gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
          properties: { text: 'Header' }
        },
        {
          id: 'b2',
          type: 'PARAGRAPH',
          gridArea: { row: 1, col: 0, rowSpan: 1, colSpan: 6 },
          properties: { text: 'Left column' }
        },
        {
          id: 'b3',
          type: 'PARAGRAPH',
          gridArea: { row: 1, col: 6, rowSpan: 1, colSpan: 6 },
          properties: { text: 'Right column' }
        }
      ];

      currentState.components = bulkComponents;
      undoRedoManager.pushState(currentState, 'Add layout template');

      // Clear all
      currentState.components = [];
      undoRedoManager.pushState(currentState, 'Clear all');

      expect(currentState.components).toHaveLength(0);

      // Undo clear
      const undoState = undoRedoManager.undo();
      expect(undoState!.components).toHaveLength(3);
    });
  });

  describe('History Management', () => {
    it('should maintain history limit', () => {
      // Push many states
      for (let i = 0; i < 60; i++) {
        currentState.components = [{
          id: `comp-${i}`,
          type: 'TEXT',
          gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
          properties: { text: `State ${i}` }
        }];
        undoRedoManager.pushState(currentState, `Change ${i}`);
      }

      const history = undoRedoManager.getHistory();
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should branch history on new action after undo', () => {
      // Create linear history
      currentState.components = [{
        id: '1',
        type: 'TEXT',
        gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
        properties: { text: 'v1' }
      }];
      undoRedoManager.pushState(currentState, 'Version 1');

      currentState.components[0].properties.text = 'v2';
      undoRedoManager.pushState(currentState, 'Version 2');

      currentState.components[0].properties.text = 'v3';
      undoRedoManager.pushState(currentState, 'Version 3');

      // Undo to v2
      undoRedoManager.undo();

      // Create new branch
      currentState.components[0].properties.text = 'v2-branch';
      undoRedoManager.pushState(currentState, 'Version 2 branch');

      // Cannot redo to v3 anymore
      expect(undoRedoManager.canRedo()).toBe(false);

      const history = undoRedoManager.getHistory();
      const lastEntry = history[history.length - 1];
      expect(lastEntry.description).toBe('Version 2 branch');
    });
  });

  describe('State Persistence', () => {
    it('should save checkpoints to database', async () => {
      // Setup some state
      currentState.components = [
        {
          id: 'persist-1',
          type: 'HEADING',
          gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
          properties: { text: 'Checkpoint Test' }
        }
      ];
      undoRedoManager.pushState(currentState, 'Test state');

      // Save checkpoint
      await undoRedoManager.saveCheckpoint('/test-page');

      // Verify it was saved (checkpoint will have timestamp suffix)
      const pages = await database.getAllPages();
      const checkpoint = pages.find(p => p.slug.startsWith('/test-page-checkpoint'));
      expect(checkpoint).toBeDefined();
    });

    it('should compress state for bandwidth efficiency', () => {
      // Create state with multiple components
      currentState.components = Array.from({ length: 10 }, (_, i) => ({
        id: `comp-${i}`,
        type: 'PARAGRAPH',
        gridArea: { row: i, col: 0, rowSpan: 1, colSpan: 12 },
        properties: { text: `Paragraph ${i} with some content to test compression` }
      }));

      const stateJson = JSON.stringify(currentState);
      const compressed = compressor.compress(stateJson);

      expect(compressed.length).toBeLessThan(stateJson.length);
      expect(compressed.length).toBeLessThan(2048); // Under 2KB for radio
    });
  });

  describe('Selection State', () => {
    it('should track component selection in history', () => {
      const comp: Component = {
        id: 'selectable',
        type: 'BUTTON',
        gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 4 },
        properties: { text: 'Select Me' }
      };

      currentState.components = [comp];
      currentState.selectedComponentId = null;
      undoRedoManager.pushState(currentState, 'Add component');

      // Select component
      currentState.selectedComponentId = 'selectable';
      undoRedoManager.pushState(currentState, 'Select component');

      // Modify selected component
      const selectedComp = currentState.components.find(c => c.id === currentState.selectedComponentId);
      if (selectedComp) {
        selectedComp.properties.text = 'Selected!';
      }
      undoRedoManager.pushState(currentState, 'Modify selected');

      // Undo should restore selection state
      undoRedoManager.undo();
      const previousState = undoRedoManager.undo();

      expect(previousState!.selectedComponentId).toBe(null);
    });
  });

  afterEach(async () => {
    // Clean up
    undoRedoManager.clear();
    await database.close();
    vi.clearAllMocks();
  });
});