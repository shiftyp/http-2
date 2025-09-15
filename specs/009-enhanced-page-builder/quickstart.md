# Quickstart: Enhanced Page Builder

## Overview
This quickstart validates the enhanced page builder functionality through complete user scenarios. Execute these steps to verify all functional requirements are working correctly.

## Prerequisites
- HTTP-over-Radio application running in development mode
- Page Builder accessible via navigation
- Component palette and property editor visible

## Test Scenario 1: Container Creation and Child Addition

### Step 1: Create Container Component
1. Open Page Builder from navigation menu
2. Locate Component Palette on left sidebar
3. Drag "Container" component to grid canvas
4. Verify container appears with empty state message: "Container - Drop components here or add via Properties panel"

**Expected Result**: Empty container component displayed with dashed border and instruction text

### Step 2: Access Children Management
1. Click on the container component to select it
2. Open Property Editor on right sidebar (should appear automatically)
3. Click on "Children" tab
4. Verify tab shows "Children (0)" with no child count indicator

**Expected Result**: Children tab active showing "No child components" message and "Add Child..." dropdown

### Step 3: Add Child Components
1. Click "Add Child..." dropdown in Children tab
2. Select "Button" from dropdown options
3. Verify new button appears in container
4. Verify Children tab shows "Children (1)" with count indicator
5. Repeat process to add "Text" component
6. Verify container shows both button and text components nested inside

**Expected Result**: Container displays 2 child components, Children tab shows "(2)" count

## Test Scenario 2: Child Component Property Editing

### Step 4: Edit Child Properties
1. In Children tab, locate the button component entry
2. Click "Edit" button next to the button component
3. Verify Property Editor switches to button's properties
4. In Basic tab, change content from "Click Me" to "Submit Form"
5. Verify button text updates in the container

**Expected Result**: Button displays "Submit Form" text, property editor shows button properties

### Step 5: Return to Parent Editing
1. Click on the container component again (not the child button)
2. Verify Property Editor switches back to container properties
3. Verify Children tab still shows both child components

**Expected Result**: Container properties displayed, children still visible in Children tab

## Test Scenario 3: Complex Hierarchy Creation

### Step 6: Create Form with Multiple Children
1. Drag "Form" component to canvas
2. Select form component, go to Children tab
3. Add the following child components in order:
   - Heading (content: "Contact Form")
   - Input (placeholder: "Name", type: "text")
   - Input (placeholder: "Email", type: "email")
   - Button (content: "Send Message")

**Expected Result**: Form contains 4 nested components displayed sequentially

### Step 7: Test List Container
1. Drag "List" component to canvas
2. Add 3 Text child components with different content
3. Verify list displays bullet points for each text item

**Expected Result**: Bulleted list with 3 text items

## Test Scenario 4: Hierarchy Management Operations

### Step 8: Test Child Deletion
1. Select form component from Step 6
2. Go to Children tab
3. Click delete (×) button next to one of the input components
4. Verify component is removed from form
5. Verify Children count decreases

**Expected Result**: Selected child removed, form layout updates, count decreases

### Step 9: Test Parent Deletion Warning
1. Create a container with at least 2 child components
2. Select the container component
3. Click "Delete Component" button in Property Editor
4. Verify warning dialog appears stating: "This component contains X nested components. Deleting it will also remove all nested components. Are you sure you want to continue?"
5. Click "Cancel" to test warning effectiveness

**Expected Result**: Warning dialog with accurate child count, deletion cancelled

### Step 10: Test Parent Movement with Children
1. Select container with children from previous step
2. Drag container to new position on grid
3. Verify all child components move together with parent
4. Verify child relationships preserved after move

**Expected Result**: Entire hierarchy moves as unit, children remain nested

## Test Scenario 5: Visual Hierarchy Indicators

### Step 11: Verify Visual Indicators
1. Create containers with different child counts
2. Verify Children tab shows accurate count badges
3. Verify container components display child count in their visual representation
4. Verify empty containers show appropriate empty state messages

**Expected Result**: Clear visual feedback for component hierarchy status

### Step 12: Test Resize with Children
1. Select container with children
2. Use resize handles to expand container
3. Verify children remain properly positioned within expanded container
4. Resize to smaller size and verify children adapt appropriately

**Expected Result**: Children maintain proper layout within parent boundaries

## Validation Checklist

### Functional Requirements Validation
- [ ] FR-001: Components contain child components hierarchically ✓
- [ ] FR-002: Children tab displays in property editor ✓
- [ ] FR-003: Add, remove child components works ✓
- [ ] FR-004: Nested components render visually ✓
- [ ] FR-005: Parent-child relationships maintained during drag/drop ✓
- [ ] FR-006: Individual child property editing works ✓
- [ ] FR-007: Circular nesting prevention (test by trying to add container to itself)
- [ ] FR-008: Unlimited nesting depth supported ✓
- [ ] FR-009: Children preserved when parent moved/resized ✓
- [ ] FR-010: Child components independently editable ✓
- [ ] FR-011: Visual indicators show parent-child relationships ✓
- [ ] FR-012: Deleting parent removes all children ✓
- [ ] FR-013: Deletion warning shows child count ✓

### User Scenarios Validation
- [ ] Container creation and child addition workflow ✓
- [ ] Child property editing without affecting parent ✓
- [ ] Hierarchy movement preservation ✓
- [ ] Visual feedback for component relationships ✓
- [ ] Safe deletion with user confirmation ✓

## Troubleshooting

### Common Issues
**Children tab not appearing**: Ensure component is selected and Property Editor is visible

**Child components not rendering**: Check browser console for JavaScript errors

**Deletion warning not showing**: Verify component actually has children before testing

**Drag operations not working**: Ensure drag and drop is enabled and components are not locked

### Performance Validation
- Test with deeply nested hierarchies (5+ levels)
- Verify smooth performance with 10+ children in single container
- Check memory usage doesn't increase significantly with hierarchy complexity

## Success Criteria
All functional requirements checked, all user scenarios completed successfully, visual hierarchy clear and intuitive, performance remains acceptable with complex hierarchies.

This quickstart validates that the enhanced page builder successfully implements hierarchical component nesting with full user interaction support.