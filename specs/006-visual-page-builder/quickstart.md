# Visual Page Builder Quickstart

## Prerequisites
- Ham radio callsign
- Modern browser with IndexedDB support
- 2KB bandwidth constraint awareness

## Quick Test Scenarios

### Scenario 1: Create First Page
```typescript
// Test: User creates their first page
it('should create a basic page with text component', async () => {
  // 1. Open page builder
  await openPageBuilder();

  // 2. Create new page
  const page = await createPage({
    title: 'My First Page',
    slug: 'home'
  });

  // 3. Drag text component to canvas
  await dragComponent('text', { row: 1, col: 1 });

  // 4. Edit text content
  await editComponent('text-1', {
    content: 'Welcome to my ham radio site!'
  });

  // 5. Save page
  await savePage();

  // 6. Verify size constraint
  expect(page.metadata.compressedSize).toBeLessThan(2048);
  expect(page.metadata.bandwidthValid).toBe(true);
});
```

### Scenario 2: Apply Template
```typescript
// Test: User applies a template to new page
it('should apply contact template to page', async () => {
  // 1. Create new page
  const page = await createPage({
    title: 'Contact',
    slug: 'contact'
  });

  // 2. Browse templates
  const templates = await browseTemplates('contact');

  // 3. Apply template
  await applyTemplate(templates[0].id);

  // 4. Customize content
  await editComponent('heading-1', {
    content: 'Contact KA1ABC'
  });

  // 5. Preview page
  const preview = await previewPage();
  expect(preview).toContain('Contact KA1ABC');
});
```

### Scenario 3: Wire Form to Function
```typescript
// Test: User connects form to backend function
it('should wire contact form to submit function', async () => {
  // 1. Add form component
  await dragComponent('form', { row: 2, col: 1, colSpan: 12 });

  // 2. Add input fields
  await addFormField('email', 'email');
  await addFormField('message', 'textarea');

  // 3. Open action panel
  await openActionPanel('form-1');

  // 4. Select submit event
  await selectEvent('submit');

  // 5. Choose server function
  const functions = await browseFunctions('form');
  await selectFunction('submitContactForm');

  // 6. Map parameters
  await mapParameter('email', 'form.email');
  await mapParameter('message', 'form.message');

  // 7. Test action
  const result = await testAction({
    email: 'test@example.com',
    message: 'Test message'
  });
  expect(result.success).toBe(true);
});
```

### Scenario 4: Multi-Page Navigation
```typescript
// Test: User creates multi-page site with navigation
it('should create site with navigation', async () => {
  // 1. Create site
  const site = await createSite({
    callsign: 'KA1ABC',
    name: 'My Radio Station'
  });

  // 2. Create multiple pages
  await createPage({ title: 'Home', slug: 'home' });
  await createPage({ title: 'About', slug: 'about' });
  await createPage({ title: 'Contact', slug: 'contact' });

  // 3. Add navigation component
  await dragComponent('navigation', { row: 1, col: 1, colSpan: 12 });

  // 4. Configure links
  await configureNavigation([
    { label: 'Home', page: 'home' },
    { label: 'About', page: 'about' },
    { label: 'Contact', page: 'contact' }
  ]);

  // 5. Test navigation
  await clickLink('About');
  expect(currentPage().slug).toBe('about');
});
```

### Scenario 5: Undo/Redo Operations
```typescript
// Test: User uses undo/redo functionality
it('should support undo/redo operations', async () => {
  // 1. Add component
  await dragComponent('text', { row: 1, col: 1 });
  const componentId = 'text-1';

  // 2. Edit content
  await editComponent(componentId, {
    content: 'Original text'
  });

  // 3. Move component
  await moveComponent(componentId, { row: 2, col: 3 });

  // 4. Undo move
  await undo();
  expect(getComponent(componentId).gridArea.row).toBe(1);

  // 5. Redo move
  await redo();
  expect(getComponent(componentId).gridArea.row).toBe(2);

  // 6. Undo all
  await undo(); // Undo move
  await undo(); // Undo edit
  await undo(); // Undo add
  expect(getComponent(componentId)).toBeNull();
});
```

### Scenario 6: Responsive Preview
```typescript
// Test: User previews page on different screen sizes
it('should show responsive preview', async () => {
  // 1. Create page with grid layout
  await createPageWithGrid();

  // 2. Add components
  await dragComponent('heading', { row: 1, col: 1, colSpan: 12 });
  await dragComponent('text', { row: 2, col: 1, colSpan: 6 });
  await dragComponent('image', { row: 2, col: 7, colSpan: 6 });

  // 3. Preview desktop
  await setPreviewSize('desktop');
  const desktopLayout = await getLayout();
  expect(desktopLayout.columns).toBe(12);

  // 4. Preview tablet
  await setPreviewSize('tablet');
  const tabletLayout = await getLayout();
  expect(tabletLayout.columns).toBe(8);

  // 5. Preview mobile
  await setPreviewSize('mobile');
  const mobileLayout = await getLayout();
  expect(mobileLayout.columns).toBe(4);
  expect(mobileLayout.stackComponents).toBe(true);
});
```

### Scenario 7: Template Export/Import
```typescript
// Test: User shares template with another callsign
it('should export and import template', async () => {
  // 1. Create custom page
  await createCustomPage();

  // 2. Save as template
  const template = await saveAsTemplate({
    name: 'My Custom Layout',
    category: 'custom',
    isPublic: true
  });

  // 3. Export template
  const exported = await exportTemplate(template.id);
  expect(exported.format).toBe('application/json');

  // 4. Switch to different callsign
  await switchCallsign('KB2DEF');

  // 5. Import template
  await importTemplate(exported.data);

  // 6. Apply imported template
  const imported = await getTemplate('My Custom Layout');
  await applyTemplate(imported.id);

  // 7. Verify template applied
  expect(currentPage().templateId).toBe(imported.id);
});
```

### Scenario 8: Bandwidth Validation
```typescript
// Test: User receives warning when page exceeds 2KB
it('should warn about bandwidth limit', async () => {
  // 1. Create page
  await createPage({ title: 'Large Page' });

  // 2. Add many components
  for (let i = 0; i < 50; i++) {
    await dragComponent('text', {
      row: Math.floor(i / 12) + 1,
      col: (i % 12) + 1
    });
    await editComponent(`text-${i}`, {
      content: `This is component ${i} with lots of text content...`
    });
  }

  // 3. Attempt to save
  const saveResult = await savePage();

  // 4. Verify warning
  expect(saveResult.warning).toBe('Page exceeds 2KB limit');
  expect(saveResult.compressedSize).toBeGreaterThan(2048);

  // 5. Show optimization suggestions
  const suggestions = await getOptimizationSuggestions();
  expect(suggestions).toContain('Use templates for repeated components');
  expect(suggestions).toContain('Reduce text content');
});
```

## Complete Test Flow

```typescript
describe('Visual Page Builder E2E', () => {
  beforeEach(async () => {
    await clearDatabase();
    await initializePageBuilder();
  });

  it('should complete full page building workflow', async () => {
    // 1. Setup
    const callsign = 'KA1ABC';
    await setCallsign(callsign);

    // 2. Create site
    const site = await createSite({
      callsign,
      name: 'Test Radio Station'
    });

    // 3. Build home page
    await createPage({ title: 'Home', slug: 'home' });
    await buildHomePage();

    // 4. Add interactivity
    await addContactForm();
    await wireFormSubmission();

    // 5. Apply responsive design
    await configureResponsiveLayout();

    // 6. Validate bandwidth
    const validation = await validatePage();
    expect(validation.valid).toBe(true);
    expect(validation.compressedSize).toBeLessThan(2048);

    // 7. Preview
    const preview = await previewPage();
    expect(preview).toMatchSnapshot();

    // 8. Publish
    await publishSite(site.id);

    // 9. Verify accessible via radio
    const radioUrl = `http://${callsign}.radio/home`;
    const response = await fetchViaRadio(radioUrl);
    expect(response.status).toBe(200);
  });
});
```

## Performance Benchmarks

- Component drag: < 100ms
- Page save: < 500ms
- Template apply: < 200ms
- Undo/redo: < 50ms
- Preview generation: < 300ms
- Bandwidth validation: < 100ms
- Page load: < 1s

## Common Operations

### Add Component
```javascript
pageBuilder.addComponent(type, gridPosition, properties);
```

### Edit Properties
```javascript
pageBuilder.editComponent(componentId, {
  basic: { fontSize: 'large' },
  advanced: { color: '#333' }
});
```

### Wire Action
```javascript
pageBuilder.wireAction({
  componentId: 'button-1',
  event: 'click',
  action: { type: 'server', handler: 'submitForm' },
  params: [{ source: 'form', sourcePath: 'email', targetParam: 'email' }]
});
```

### Save Template
```javascript
pageBuilder.saveAsTemplate({
  name: 'My Template',
  category: 'custom',
  isPublic: true
});
```

## Troubleshooting

### Page exceeds 2KB limit
- Use component templates
- Minimize text content
- Enable advanced compression
- Remove unnecessary styles

### Components not aligning
- Check grid settings
- Verify responsive breakpoints
- Use grid snap feature

### Actions not working
- Verify function availability
- Check parameter mappings
- Test in debug mode
- Review action conditions

### Template not applying
- Ensure compatible grid layout
- Check component type support
- Verify template version