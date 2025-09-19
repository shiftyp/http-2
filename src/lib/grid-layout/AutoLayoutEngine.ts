/**
 * Auto Layout Engine
 *
 * Provides intelligent layout suggestions and automatic component placement
 * optimization for the Visual Page Builder grid system.
 */

import { PageComponent, ComponentType, GridPosition, GridLayout } from '../../pages/PageBuilder';

export interface LayoutSuggestion {
  id: string;
  name: string;
  description: string;
  efficiency: number; // 0-100 percentage
  changes: ComponentLayoutChange[];
  preview?: string; // ASCII art preview
}

export interface ComponentLayoutChange {
  componentId: string;
  oldPosition: GridPosition;
  newPosition: GridPosition;
  reason: string;
}

export interface AutoLayoutOptions {
  prioritizeReadability: boolean;
  minimizeWhitespace: boolean;
  groupRelatedComponents: boolean;
  respectManualPositions: boolean;
  targetBreakpoint?: number; // Width in pixels
}

export class AutoLayoutEngine {
  /**
   * Generate layout suggestions for current components
   */
  generateSuggestions(
    components: PageComponent[],
    gridLayout: GridLayout,
    options: AutoLayoutOptions = {
      prioritizeReadability: true,
      minimizeWhitespace: true,
      groupRelatedComponents: true,
      respectManualPositions: false
    }
  ): LayoutSuggestion[] {
    const suggestions: LayoutSuggestion[] = [];

    // Suggestion 1: Compact Layout
    const compactSuggestion = this.generateCompactLayout(components, gridLayout, options);
    if (compactSuggestion) suggestions.push(compactSuggestion);

    // Suggestion 2: Reading Flow Optimization
    const readingFlowSuggestion = this.generateReadingFlowLayout(components, gridLayout, options);
    if (readingFlowSuggestion) suggestions.push(readingFlowSuggestion);

    // Suggestion 3: Component Type Grouping
    const groupingSuggestion = this.generateGroupedLayout(components, gridLayout, options);
    if (groupingSuggestion) suggestions.push(groupingSuggestion);

    // Suggestion 4: Responsive Optimization
    const responsiveSuggestion = this.generateResponsiveLayout(components, gridLayout, options);
    if (responsiveSuggestion) suggestions.push(responsiveSuggestion);

    return suggestions.sort((a, b) => b.efficiency - a.efficiency);
  }

  /**
   * Generate compact layout suggestion
   */
  private generateCompactLayout(
    components: PageComponent[],
    gridLayout: GridLayout,
    options: AutoLayoutOptions
  ): LayoutSuggestion | null {
    const changes: ComponentLayoutChange[] = [];
    const occupancyMap = new Map<string, PageComponent>();

    // Sort components by priority (headings first, then content)
    const sortedComponents = [...components].sort((a, b) => {
      const aPriority = this.getComponentPriority(a.type);
      const bPriority = this.getComponentPriority(b.type);
      return aPriority - bPriority;
    });

    let currentRow = 1;
    let currentCol = 1;

    for (const component of sortedComponents) {
      // Find optimal position for this component
      const optimalPosition = this.findOptimalPosition(
        component,
        occupancyMap,
        gridLayout,
        currentRow,
        currentCol
      );

      if (optimalPosition && !this.positionsEqual(component.gridArea, optimalPosition)) {
        changes.push({
          componentId: component.id,
          oldPosition: component.gridArea,
          newPosition: optimalPosition,
          reason: 'Compacted for better space utilization'
        });

        // Update occupancy map
        this.markOccupied(occupancyMap, component.id, optimalPosition);
      } else {
        this.markOccupied(occupancyMap, component.id, component.gridArea);
      }

      // Update current position for next component
      currentCol = optimalPosition ? optimalPosition.col + optimalPosition.colSpan : currentCol + 1;
      if (currentCol > gridLayout.columns) {
        currentCol = 1;
        currentRow++;
      }
    }

    if (changes.length === 0) return null;

    const efficiency = this.calculateEfficiency(components, changes, gridLayout);

    return {
      id: 'compact-layout',
      name: 'Compact Layout',
      description: `Reduces whitespace by ${Math.round(efficiency)}%. Moves ${changes.length} components to optimize space usage.`,
      efficiency,
      changes,
      preview: this.generatePreview(components, changes, gridLayout)
    };
  }

  /**
   * Generate reading flow optimized layout
   */
  private generateReadingFlowLayout(
    components: PageComponent[],
    gridLayout: GridLayout,
    options: AutoLayoutOptions
  ): LayoutSuggestion | null {
    const changes: ComponentLayoutChange[] = [];

    // Group components by semantic flow
    const headings = components.filter(c => c.type === ComponentType.HEADING);
    const content = components.filter(c =>
      [ComponentType.PARAGRAPH, ComponentType.TEXT, ComponentType.LIST].includes(c.type)
    );
    const interactive = components.filter(c =>
      [ComponentType.BUTTON, ComponentType.INPUT, ComponentType.FORM].includes(c.type)
    );
    const media = components.filter(c =>
      [ComponentType.IMAGE, ComponentType.RICH_MEDIA].includes(c.type)
    );

    let currentRow = 1;

    // Place headings first, full width
    for (const heading of headings) {
      const newPosition: GridPosition = {
        row: currentRow,
        col: 1,
        rowSpan: 1,
        colSpan: gridLayout.columns
      };

      if (!this.positionsEqual(heading.gridArea, newPosition)) {
        changes.push({
          componentId: heading.id,
          oldPosition: heading.gridArea,
          newPosition,
          reason: 'Optimized for reading flow hierarchy'
        });
      }
      currentRow++;
    }

    // Place content in reading columns
    const contentPerRow = Math.min(2, gridLayout.columns);
    let contentCol = 1;

    for (const item of content) {
      const colSpan = Math.floor(gridLayout.columns / contentPerRow);
      const newPosition: GridPosition = {
        row: currentRow,
        col: contentCol,
        rowSpan: 1,
        colSpan
      };

      if (!this.positionsEqual(item.gridArea, newPosition)) {
        changes.push({
          componentId: item.id,
          oldPosition: item.gridArea,
          newPosition,
          reason: 'Arranged for optimal reading flow'
        });
      }

      contentCol += colSpan;
      if (contentCol > gridLayout.columns) {
        contentCol = 1;
        currentRow++;
      }
    }

    if (changes.length === 0) return null;

    const efficiency = this.calculateReadabilityScore(components, changes);

    return {
      id: 'reading-flow',
      name: 'Reading Flow',
      description: `Improves readability by ${Math.round(efficiency)}%. Organizes content in natural reading order.`,
      efficiency,
      changes,
      preview: this.generatePreview(components, changes, gridLayout)
    };
  }

  /**
   * Generate grouped layout by component type
   */
  private generateGroupedLayout(
    components: PageComponent[],
    gridLayout: GridLayout,
    options: AutoLayoutOptions
  ): LayoutSuggestion | null {
    const changes: ComponentLayoutChange[] = [];

    // Group by component type
    const groups = new Map<ComponentType, PageComponent[]>();

    for (const component of components) {
      if (!groups.has(component.type)) {
        groups.set(component.type, []);
      }
      groups.get(component.type)!.push(component);
    }

    let currentRow = 1;

    // Define logical group order
    const groupOrder = [
      ComponentType.HEADING,
      ComponentType.PARAGRAPH,
      ComponentType.TEXT,
      ComponentType.IMAGE,
      ComponentType.RICH_MEDIA,
      ComponentType.FORM,
      ComponentType.INPUT,
      ComponentType.BUTTON,
      ComponentType.LIST,
      ComponentType.TABLE,
      ComponentType.DIVIDER
    ];

    for (const type of groupOrder) {
      const groupComponents = groups.get(type);
      if (!groupComponents || groupComponents.length === 0) continue;

      let currentCol = 1;

      for (const component of groupComponents) {
        const colSpan = component.gridArea.colSpan;

        // Check if component fits in current row
        if (currentCol + colSpan - 1 > gridLayout.columns) {
          currentCol = 1;
          currentRow++;
        }

        const newPosition: GridPosition = {
          row: currentRow,
          col: currentCol,
          rowSpan: component.gridArea.rowSpan,
          colSpan
        };

        if (!this.positionsEqual(component.gridArea, newPosition)) {
          changes.push({
            componentId: component.id,
            oldPosition: component.gridArea,
            newPosition,
            reason: `Grouped with other ${type} components`
          });
        }

        currentCol += colSpan;
      }

      // Move to next row for next group
      if (currentCol > 1) {
        currentRow++;
      }
    }

    if (changes.length === 0) return null;

    const efficiency = this.calculateGroupingEfficiency(components, changes);

    return {
      id: 'grouped-layout',
      name: 'Component Grouping',
      description: `Organizes by component type. ${Math.round(efficiency)}% better logical flow.`,
      efficiency,
      changes,
      preview: this.generatePreview(components, changes, gridLayout)
    };
  }

  /**
   * Generate responsive layout suggestion
   */
  private generateResponsiveLayout(
    components: PageComponent[],
    gridLayout: GridLayout,
    options: AutoLayoutOptions
  ): LayoutSuggestion | null {
    const changes: ComponentLayoutChange[] = [];

    // For smaller screens, stack components vertically
    for (const component of components) {
      if (component.gridArea.colSpan < gridLayout.columns) {
        const newPosition: GridPosition = {
          row: component.gridArea.row,
          col: 1,
          rowSpan: component.gridArea.rowSpan,
          colSpan: gridLayout.columns // Full width
        };

        if (!this.positionsEqual(component.gridArea, newPosition)) {
          changes.push({
            componentId: component.id,
            oldPosition: component.gridArea,
            newPosition,
            reason: 'Optimized for responsive display'
          });
        }
      }
    }

    if (changes.length === 0) return null;

    return {
      id: 'responsive-layout',
      name: 'Mobile Responsive',
      description: `Optimizes for mobile devices. ${changes.length} components adjusted for better mobile experience.`,
      efficiency: 85,
      changes,
      preview: this.generatePreview(components, changes, gridLayout)
    };
  }

  /**
   * Helper methods
   */
  private getComponentPriority(type: ComponentType): number {
    const priorities: Record<ComponentType, number> = {
      [ComponentType.HEADING]: 1,
      [ComponentType.PARAGRAPH]: 2,
      [ComponentType.TEXT]: 3,
      [ComponentType.IMAGE]: 4,
      [ComponentType.RICH_MEDIA]: 4,
      [ComponentType.FORM]: 5,
      [ComponentType.INPUT]: 6,
      [ComponentType.BUTTON]: 7,
      [ComponentType.LINK]: 8,
      [ComponentType.LIST]: 9,
      [ComponentType.TABLE]: 10,
      [ComponentType.CONTAINER]: 11,
      [ComponentType.DIVIDER]: 12,
      [ComponentType.MARKDOWN]: 13
    };
    return priorities[type] || 99;
  }

  private findOptimalPosition(
    component: PageComponent,
    occupancyMap: Map<string, PageComponent>,
    gridLayout: GridLayout,
    startRow: number,
    startCol: number
  ): GridPosition | null {
    for (let row = startRow; row <= gridLayout.rows + 2; row++) {
      for (let col = 1; col <= gridLayout.columns - component.gridArea.colSpan + 1; col++) {
        if (this.isPositionAvailable(component.gridArea, { ...component.gridArea, row, col }, occupancyMap)) {
          return { ...component.gridArea, row, col };
        }
      }
    }
    return null;
  }

  private isPositionAvailable(
    originalArea: GridPosition,
    newArea: GridPosition,
    occupancyMap: Map<string, PageComponent>
  ): boolean {
    for (let r = newArea.row; r < newArea.row + newArea.rowSpan; r++) {
      for (let c = newArea.col; c < newArea.col + newArea.colSpan; c++) {
        if (occupancyMap.has(`${r}-${c}`)) {
          return false;
        }
      }
    }
    return true;
  }

  private markOccupied(occupancyMap: Map<string, PageComponent>, componentId: string, area: GridPosition): void {
    for (let r = area.row; r < area.row + area.rowSpan; r++) {
      for (let c = area.col; c < area.col + area.colSpan; c++) {
        occupancyMap.set(`${r}-${c}`, { id: componentId } as PageComponent);
      }
    }
  }

  private positionsEqual(a: GridPosition, b: GridPosition): boolean {
    return a.row === b.row && a.col === b.col && a.rowSpan === b.rowSpan && a.colSpan === b.colSpan;
  }

  private calculateEfficiency(
    components: PageComponent[],
    changes: ComponentLayoutChange[],
    gridLayout: GridLayout
  ): number {
    const totalCells = gridLayout.rows * gridLayout.columns;
    const usedCells = components.reduce((sum, comp) => sum + (comp.gridArea.rowSpan * comp.gridArea.colSpan), 0);
    const efficiency = (usedCells / totalCells) * 100;
    return Math.min(95, efficiency + (changes.length * 2)); // Bonus for optimization
  }

  private calculateReadabilityScore(components: PageComponent[], changes: ComponentLayoutChange[]): number {
    // Simple heuristic: penalize wide text blocks, reward logical flow
    let score = 70;

    for (const change of changes) {
      const component = components.find(c => c.id === change.componentId);
      if (component?.type === ComponentType.HEADING && change.newPosition.colSpan > 2) {
        score += 5; // Headers should be wide
      }
      if ([ComponentType.PARAGRAPH, ComponentType.TEXT].includes(component?.type as ComponentType)
          && change.newPosition.colSpan <= 3) {
        score += 3; // Text should be narrow for readability
      }
    }

    return Math.min(95, score);
  }

  private calculateGroupingEfficiency(components: PageComponent[], changes: ComponentLayoutChange[]): number {
    // Count how many components are now adjacent to similar types
    let adjacentSimilar = 0;

    for (const change of changes) {
      const component = components.find(c => c.id === change.componentId);
      if (!component) continue;

      // Check if similar components are nearby in new layout
      const nearby = changes.filter(other => {
        const otherComponent = components.find(c => c.id === other.componentId);
        return otherComponent?.type === component.type &&
               Math.abs(other.newPosition.row - change.newPosition.row) <= 1;
      });

      if (nearby.length > 1) adjacentSimilar++;
    }

    return Math.min(90, 60 + (adjacentSimilar * 5));
  }

  private generatePreview(
    components: PageComponent[],
    changes: ComponentLayoutChange[],
    gridLayout: GridLayout
  ): string {
    // Generate simple ASCII preview
    const grid: string[][] = Array(Math.min(6, gridLayout.rows))
      .fill(null)
      .map(() => Array(gridLayout.columns).fill('·'));

    // Apply changes and show layout
    for (const change of changes.slice(0, 8)) { // Limit preview items
      const { newPosition } = change;
      const component = components.find(c => c.id === change.componentId);
      if (!component) continue;

      const symbol = this.getComponentSymbol(component.type);

      for (let r = 0; r < Math.min(newPosition.rowSpan, grid.length - newPosition.row + 1); r++) {
        for (let c = 0; c < Math.min(newPosition.colSpan, gridLayout.columns - newPosition.col + 1); c++) {
          const row = newPosition.row - 1 + r;
          const col = newPosition.col - 1 + c;
          if (row >= 0 && row < grid.length && col >= 0 && col < gridLayout.columns) {
            grid[row][col] = symbol;
          }
        }
      }
    }

    return grid.map(row => row.join(' ')).join('\n');
  }

  private getComponentSymbol(type: ComponentType): string {
    const symbols: Record<ComponentType, string> = {
      [ComponentType.HEADING]: 'H',
      [ComponentType.PARAGRAPH]: 'P',
      [ComponentType.TEXT]: 'T',
      [ComponentType.IMAGE]: 'I',
      [ComponentType.FORM]: 'F',
      [ComponentType.INPUT]: 'i',
      [ComponentType.BUTTON]: 'B',
      [ComponentType.LINK]: 'L',
      [ComponentType.TABLE]: 'T',
      [ComponentType.LIST]: 'l',
      [ComponentType.CONTAINER]: 'C',
      [ComponentType.DIVIDER]: '-',
      [ComponentType.MARKDOWN]: 'M',
      [ComponentType.RICH_MEDIA]: 'R'
    };
    return symbols[type] || '?';
  }
}

export default AutoLayoutEngine;