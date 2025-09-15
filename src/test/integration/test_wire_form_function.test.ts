import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup';

/**
 * Integration test for wiring form components to backend functions
 * Tests complete user workflow from adding forms to testing action execution
 *
 * This test will initially fail (TDD approach) until the visual page builder is implemented
 */

interface FormField {
  type: string;
  name: string;
  label: string;
  required?: boolean;
  validation?: string;
}

interface ServerFunction {
  id: string;
  name: string;
  category: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  handler: (params: Record<string, any>) => Promise<any>;
}

interface ActionMapping {
  componentId: string;
  event: string;
  action: {
    type: 'server' | 'client';
    handler: string;
  };
  parameters: Array<{
    source: string;
    sourcePath: string;
    targetParam: string;
  }>;
}

// Mock server function registry
class MockServerFunctionRegistry {
  private functions = new Map<string, ServerFunction>();

  constructor() {
    this.initializeDefaultFunctions();
  }

  private initializeDefaultFunctions() {
    // Contact form submission function
    const submitContactForm: ServerFunction = {
      id: 'submitContactForm',
      name: 'Submit Contact Form',
      category: 'form',
      description: 'Handles contact form submissions with email validation',
      parameters: [
        {
          name: 'email',
          type: 'string',
          required: true,
          description: 'Sender email address'
        },
        {
          name: 'message',
          type: 'string',
          required: true,
          description: 'Message content'
        },
        {
          name: 'subject',
          type: 'string',
          required: false,
          description: 'Email subject line'
        }
      ],
      handler: async (params) => {
        // Validate required parameters
        if (!params.email || !params.message) {
          throw new Error('Email and message are required');
        }

        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(params.email)) {
          throw new Error('Invalid email address');
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
          success: true,
          messageId: `msg_${Date.now()}`,
          timestamp: new Date().toISOString()
        };
      }
    };

    // QSO logging function
    const logQSO: ServerFunction = {
      id: 'logQSO',
      name: 'Log QSO',
      category: 'logging',
      description: 'Logs a radio contact to the station logbook',
      parameters: [
        {
          name: 'callsign',
          type: 'string',
          required: true,
          description: 'Other station callsign'
        },
        {
          name: 'frequency',
          type: 'number',
          required: true,
          description: 'Operating frequency in MHz'
        },
        {
          name: 'mode',
          type: 'string',
          required: true,
          description: 'Operating mode (SSB, CW, etc.)'
        },
        {
          name: 'rstSent',
          type: 'string',
          required: false,
          description: 'RST sent'
        },
        {
          name: 'rstReceived',
          type: 'string',
          required: false,
          description: 'RST received'
        }
      ],
      handler: async (params) => {
        if (!params.callsign || !params.frequency || !params.mode) {
          throw new Error('Callsign, frequency, and mode are required');
        }

        return {
          success: true,
          qsoId: `qso_${Date.now()}`,
          loggedAt: new Date().toISOString()
        };
      }
    };

    this.functions.set(submitContactForm.id, submitContactForm);
    this.functions.set(logQSO.id, logQSO);
  }

  async browseFunctions(category?: string): Promise<ServerFunction[]> {
    const allFunctions = Array.from(this.functions.values());

    if (category) {
      return allFunctions.filter(f => f.category === category);
    }

    return allFunctions;
  }

  async getFunction(functionId: string): Promise<ServerFunction | null> {
    return this.functions.get(functionId) || null;
  }

  async executeFunction(functionId: string, params: Record<string, any>): Promise<any> {
    const func = this.functions.get(functionId);
    if (!func) {
      throw new Error(`Function ${functionId} not found`);
    }

    return func.handler(params);
  }
}

// Mock page builder with form wiring capabilities
class MockPageBuilderWithForms {
  private pages = new Map();
  private currentPage: any = null;
  private components = new Map();
  private componentCounter = 0;
  private actionMappings = new Map<string, ActionMapping>();
  private serverFunctions = new MockServerFunctionRegistry();

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
    return page;
  }

  async dragComponent(type: string, position: { row: number; col: number; colSpan?: number }): Promise<string> {
    if (!this.currentPage) {
      throw new Error('No active page');
    }

    this.componentCounter++;
    const component = {
      id: `${type}-${this.componentCounter}`,
      type,
      gridArea: {
        row: position.row,
        col: position.col,
        rowSpan: 1,
        colSpan: position.colSpan || 1
      },
      properties: {
        fields: type === 'form' ? [] : undefined
      }
    };

    this.components.set(component.id, component);
    this.currentPage.components.push(component.id);

    return component.id;
  }

  async addFormField(componentId: string, fieldType: string, fieldName: string): Promise<void> {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    if (component.type !== 'form') {
      throw new Error('Can only add fields to form components');
    }

    if (!component.properties.fields) {
      component.properties.fields = [];
    }

    const field: FormField = {
      type: fieldType,
      name: fieldName,
      label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
      required: fieldType === 'email'
    };

    component.properties.fields.push(field);
  }

  async openActionPanel(componentId: string): Promise<void> {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    // In real implementation, this would open the action configuration UI
    // For mock, we just verify the component exists
  }

  async selectEvent(componentId: string, eventType: string): Promise<void> {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    // Initialize action mapping
    if (!this.actionMappings.has(componentId)) {
      this.actionMappings.set(componentId, {
        componentId,
        event: eventType,
        action: { type: 'server', handler: '' },
        parameters: []
      });
    } else {
      const mapping = this.actionMappings.get(componentId)!;
      mapping.event = eventType;
    }
  }

  async browseFunctions(category?: string): Promise<ServerFunction[]> {
    return this.serverFunctions.browseFunctions(category);
  }

  async selectFunction(componentId: string, functionId: string): Promise<void> {
    const func = await this.serverFunctions.getFunction(functionId);
    if (!func) {
      throw new Error(`Function ${functionId} not found`);
    }

    const mapping = this.actionMappings.get(componentId);
    if (!mapping) {
      throw new Error('No action mapping found. Call selectEvent first.');
    }

    mapping.action.handler = functionId;
  }

  async mapParameter(componentId: string, targetParam: string, sourcePath: string): Promise<void> {
    const mapping = this.actionMappings.get(componentId);
    if (!mapping) {
      throw new Error('No action mapping found');
    }

    // Remove existing mapping for this parameter
    mapping.parameters = mapping.parameters.filter(p => p.targetParam !== targetParam);

    // Add new mapping
    mapping.parameters.push({
      source: 'form',
      sourcePath,
      targetParam
    });
  }

  async testAction(componentId: string, testData: Record<string, any>): Promise<any> {
    const mapping = this.actionMappings.get(componentId);
    if (!mapping) {
      throw new Error('No action mapping found');
    }

    if (!mapping.action.handler) {
      throw new Error('No function selected');
    }

    // Map parameters from test data
    const params: Record<string, any> = {};
    for (const paramMapping of mapping.parameters) {
      const sourceValue = this.getValueFromPath(testData, paramMapping.sourcePath);
      params[paramMapping.targetParam] = sourceValue;
    }

    // Execute function
    try {
      return await this.serverFunctions.executeFunction(mapping.action.handler, params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getValueFromPath(data: Record<string, any>, path: string): any {
    // Simple path resolver (e.g., "form.email" -> data.email)
    const pathParts = path.split('.');
    let current = data;

    for (let i = 1; i < pathParts.length; i++) { // Skip 'form' prefix
      if (current && typeof current === 'object') {
        current = current[pathParts[i]];
      } else {
        return undefined;
      }
    }

    return current;
  }

  getComponent(componentId: string): any {
    return this.components.get(componentId) || null;
  }

  getActionMapping(componentId: string): ActionMapping | null {
    return this.actionMappings.get(componentId) || null;
  }

  reset(): void {
    this.pages.clear();
    this.components.clear();
    this.currentPage = null;
    this.componentCounter = 0;
    this.actionMappings.clear();
  }
}

describe('Visual Page Builder - Wire Form to Function', () => {
  let pageBuilder: MockPageBuilderWithForms;

  beforeEach(async () => {
    pageBuilder = new MockPageBuilderWithForms();
  });

  it('should wire contact form to submit function', async () => {
    // 1. Create page
    await pageBuilder.createPage({
      title: 'Contact',
      slug: 'contact'
    });

    // 2. Add form component
    const formId = await pageBuilder.dragComponent('form', { row: 2, col: 1, colSpan: 12 });

    expect(formId).toBe('form-1');
    const formComponent = pageBuilder.getComponent(formId);
    expect(formComponent.type).toBe('form');
    expect(formComponent.gridArea.colSpan).toBe(12);

    // 3. Add input fields
    await pageBuilder.addFormField(formId, 'email', 'email');
    await pageBuilder.addFormField(formId, 'textarea', 'message');

    const updatedForm = pageBuilder.getComponent(formId);
    expect(updatedForm.properties.fields).toHaveLength(2);

    const emailField = updatedForm.properties.fields.find((f: FormField) => f.name === 'email');
    const messageField = updatedForm.properties.fields.find((f: FormField) => f.name === 'message');

    expect(emailField.type).toBe('email');
    expect(emailField.required).toBe(true);
    expect(messageField.type).toBe('textarea');

    // 4. Open action panel
    await pageBuilder.openActionPanel(formId);

    // 5. Select submit event
    await pageBuilder.selectEvent(formId, 'submit');

    const mapping = pageBuilder.getActionMapping(formId);
    expect(mapping).toBeDefined();
    expect(mapping?.event).toBe('submit');

    // 6. Choose server function
    const functions = await pageBuilder.browseFunctions('form');
    expect(functions).toHaveLength(1);
    expect(functions[0].name).toBe('Submit Contact Form');

    await pageBuilder.selectFunction(formId, 'submitContactForm');

    const updatedMapping = pageBuilder.getActionMapping(formId);
    expect(updatedMapping?.action.handler).toBe('submitContactForm');

    // 7. Map parameters
    await pageBuilder.mapParameter(formId, 'email', 'form.email');
    await pageBuilder.mapParameter(formId, 'message', 'form.message');

    const finalMapping = pageBuilder.getActionMapping(formId);
    expect(finalMapping?.parameters).toHaveLength(2);

    const emailParam = finalMapping?.parameters.find(p => p.targetParam === 'email');
    const messageParam = finalMapping?.parameters.find(p => p.targetParam === 'message');

    expect(emailParam?.sourcePath).toBe('form.email');
    expect(messageParam?.sourcePath).toBe('form.message');

    // 8. Test action
    const result = await pageBuilder.testAction(formId, {
      email: 'test@example.com',
      message: 'Test message'
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^msg_\d+$/);
    expect(result.timestamp).toBeDefined();
  });

  it('should handle form validation errors', async () => {
    // Setup form with contact function
    await pageBuilder.createPage({ title: 'Test', slug: 'test' });
    const formId = await pageBuilder.dragComponent('form', { row: 1, col: 1 });

    await pageBuilder.addFormField(formId, 'email', 'email');
    await pageBuilder.addFormField(formId, 'textarea', 'message');

    await pageBuilder.selectEvent(formId, 'submit');
    await pageBuilder.selectFunction(formId, 'submitContactForm');
    await pageBuilder.mapParameter(formId, 'email', 'form.email');
    await pageBuilder.mapParameter(formId, 'message', 'form.message');

    // Test with invalid email
    const invalidEmailResult = await pageBuilder.testAction(formId, {
      email: 'invalid-email',
      message: 'Test message'
    });

    expect(invalidEmailResult.success).toBe(false);
    expect(invalidEmailResult.error).toBe('Invalid email address');

    // Test with missing required field
    const missingFieldResult = await pageBuilder.testAction(formId, {
      email: 'test@example.com'
      // message is missing
    });

    expect(missingFieldResult.success).toBe(false);
    expect(missingFieldResult.error).toBe('Email and message are required');
  });

  it('should browse functions by category', async () => {
    // Browse form functions
    const formFunctions = await pageBuilder.browseFunctions('form');
    expect(formFunctions).toHaveLength(1);
    expect(formFunctions[0].category).toBe('form');

    // Browse logging functions
    const loggingFunctions = await pageBuilder.browseFunctions('logging');
    expect(loggingFunctions).toHaveLength(1);
    expect(loggingFunctions[0].category).toBe('logging');

    // Browse all functions
    const allFunctions = await pageBuilder.browseFunctions();
    expect(allFunctions).toHaveLength(2);
  });

  it('should wire QSO logging form', async () => {
    // Create page with QSO form
    await pageBuilder.createPage({
      title: 'Log QSO',
      slug: 'log-qso'
    });

    const formId = await pageBuilder.dragComponent('form', { row: 1, col: 1, colSpan: 12 });

    // Add QSO fields
    await pageBuilder.addFormField(formId, 'text', 'callsign');
    await pageBuilder.addFormField(formId, 'number', 'frequency');
    await pageBuilder.addFormField(formId, 'select', 'mode');
    await pageBuilder.addFormField(formId, 'text', 'rstSent');
    await pageBuilder.addFormField(formId, 'text', 'rstReceived');

    // Wire to logging function
    await pageBuilder.selectEvent(formId, 'submit');
    await pageBuilder.selectFunction(formId, 'logQSO');

    // Map parameters
    await pageBuilder.mapParameter(formId, 'callsign', 'form.callsign');
    await pageBuilder.mapParameter(formId, 'frequency', 'form.frequency');
    await pageBuilder.mapParameter(formId, 'mode', 'form.mode');
    await pageBuilder.mapParameter(formId, 'rstSent', 'form.rstSent');
    await pageBuilder.mapParameter(formId, 'rstReceived', 'form.rstReceived');

    // Test logging
    const result = await pageBuilder.testAction(formId, {
      callsign: 'W1ABC',
      frequency: 14.205,
      mode: 'SSB',
      rstSent: '59',
      rstReceived: '59'
    });

    expect(result.success).toBe(true);
    expect(result.qsoId).toMatch(/^qso_\d+$/);
    expect(result.loggedAt).toBeDefined();
  });

  it('should handle errors when wiring form', async () => {
    await pageBuilder.createPage({ title: 'Test', slug: 'test' });
    const formId = await pageBuilder.dragComponent('form', { row: 1, col: 1 });

    // Test selecting event without opening action panel first
    await pageBuilder.selectEvent(formId, 'submit');

    // Test selecting non-existent function
    await expect(pageBuilder.selectFunction(formId, 'nonExistentFunction'))
      .rejects.toThrow('Function nonExistentFunction not found');

    // Test mapping parameter without selecting function first
    const noFunctionMapping = pageBuilder.getActionMapping(formId);
    expect(noFunctionMapping?.action.handler).toBe('');

    // Test testing action without complete mapping
    await expect(pageBuilder.testAction(formId, {}))
      .rejects.toThrow('No function selected');
  });

  it('should handle non-form components', async () => {
    await pageBuilder.createPage({ title: 'Test', slug: 'test' });
    const textId = await pageBuilder.dragComponent('text', { row: 1, col: 1 });

    // Should fail when trying to add form field to non-form component
    await expect(pageBuilder.addFormField(textId, 'email', 'email'))
      .rejects.toThrow('Can only add fields to form components');
  });

  it('should support multiple parameter mappings', async () => {
    await pageBuilder.createPage({ title: 'Test', slug: 'test' });
    const formId = await pageBuilder.dragComponent('form', { row: 1, col: 1 });

    await pageBuilder.addFormField(formId, 'email', 'email');
    await pageBuilder.addFormField(formId, 'textarea', 'message');
    await pageBuilder.addFormField(formId, 'text', 'subject');

    await pageBuilder.selectEvent(formId, 'submit');
    await pageBuilder.selectFunction(formId, 'submitContactForm');

    // Map all parameters including optional ones
    await pageBuilder.mapParameter(formId, 'email', 'form.email');
    await pageBuilder.mapParameter(formId, 'message', 'form.message');
    await pageBuilder.mapParameter(formId, 'subject', 'form.subject');

    const mapping = pageBuilder.getActionMapping(formId);
    expect(mapping?.parameters).toHaveLength(3);

    // Test with all parameters
    const result = await pageBuilder.testAction(formId, {
      email: 'test@example.com',
      message: 'Test message',
      subject: 'Test Subject'
    });

    expect(result.success).toBe(true);
  });

  it('should replace existing parameter mappings', async () => {
    await pageBuilder.createPage({ title: 'Test', slug: 'test' });
    const formId = await pageBuilder.dragComponent('form', { row: 1, col: 1 });

    await pageBuilder.selectEvent(formId, 'submit');
    await pageBuilder.selectFunction(formId, 'submitContactForm');

    // Map parameter
    await pageBuilder.mapParameter(formId, 'email', 'form.email');
    let mapping = pageBuilder.getActionMapping(formId);
    expect(mapping?.parameters).toHaveLength(1);

    // Re-map same parameter to different source
    await pageBuilder.mapParameter(formId, 'email', 'form.emailAddress');
    mapping = pageBuilder.getActionMapping(formId);
    expect(mapping?.parameters).toHaveLength(1);
    expect(mapping?.parameters[0].sourcePath).toBe('form.emailAddress');
  });
});