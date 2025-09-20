# Input Component Migration Contract

**Component**: Input
**Original**: `src/components/ui/Input.tsx`
**Target**: Chakra UI Input
**Priority**: High (foundational form component)

## Original API Contract

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  variant?: 'default' | 'filled' | 'outline';
  className?: string;
}
```

## Chakra UI Migration Contract

```typescript
import {
  Input as ChakraInput,
  FormControl,
  FormLabel,
  FormErrorMessage,
  InputProps as ChakraInputProps
} from '@chakra-ui/react';

interface MigratedInputProps extends Omit<ChakraInputProps, 'variant'> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  variant?: 'default' | 'filled' | 'outline';
  isRequired?: boolean;
  helperText?: string;
}
```

## Prop Mapping

| Original Prop | Chakra Prop | Transform | Notes |
|---------------|-------------|-----------|-------|
| `label` | `FormLabel` | Component | Wrapped in FormControl |
| `error` | `FormErrorMessage` | Component | Conditional rendering |
| `fullWidth` | `width='full'` | Transform | Boolean → width value |
| `variant='default'` | `variant='outline'` | Map | Default to outline |
| `variant='filled'` | `variant='filled'` | Direct | Chakra native |
| `variant='outline'` | `variant='outline'` | Direct | Chakra native |
| `className` | `className` | Direct | Preserved for override |
| `disabled` | `isDisabled` | Rename | Chakra naming |
| `required` | `isRequired` | Rename | Chakra naming |

## Visual Requirements

### Variant Styles
- **Default/Outline**: Border with radio.border color, transparent background
- **Filled**: radio.tertiary background, no border
- **Focus**: radio.accent.primary border, blue glow
- **Error**: radio.accent.danger border, red glow
- **Disabled**: 50% opacity, no interactions

### Typography
- **Font**: System font stack (preserved)
- **Size**: 16px base (prevents mobile zoom)
- **Placeholder**: radio.text.muted color

### Spacing
- **Padding**: 12px horizontal, 8px vertical
- **Label spacing**: 4px below label
- **Error spacing**: 4px below input

## Form Integration Contract

### FormControl Wrapper
All inputs must be wrapped in Chakra's FormControl for:
- Label association (htmlFor/id relationship)
- Error state management
- Required field indicators
- Accessibility attributes

### Validation Integration
```typescript
interface ValidationConfig {
  isInvalid: boolean;
  errorMessage?: string;
  isRequired?: boolean;
  helperText?: string;
}
```

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- ✅ Label association with input field
- ✅ Error announcements for screen readers
- ✅ Required field indicators
- ✅ Keyboard navigation support
- ✅ Focus indicators visible

### Enhanced Features (via Chakra UI)
- Automatic ARIA attributes
- Error state management
- Screen reader optimizations
- Focus trap support in forms

## Performance Contract

### Bundle Size Impact
- **Before**: Custom Input component (~3KB)
- **After**: Chakra Input + FormControl (~5KB)
- **Increase**: ~2KB (acceptable for features gained)

### Render Performance
- **Target**: No regression in form rendering
- **Measurement**: Input render < 8ms
- **Memory**: Efficient re-renders on value changes

## Testing Contract

### Unit Tests Required
```typescript
describe('Input Migration', () => {
  test('renders with label correctly', () => {});
  test('displays error messages', () => {});
  test('handles variant styles', () => {});
  test('supports fullWidth prop', () => {});
  test('forwards DOM props correctly', () => {});
  test('maintains accessibility attributes', () => {});
  test('integrates with form validation', () => {});
});
```

### Form Integration Tests
- Label-input association
- Error state propagation
- Required field validation
- Form submission handling

### Accessibility Tests
- Screen reader announcements
- Keyboard navigation
- Label association verification
- Error message accessibility

## Radio-Specific Requirements

### Dark Theme Integration
- Input background: radio.tertiary
- Border color: radio.border
- Text color: radio.text.primary
- Placeholder: radio.text.muted
- Focus ring: radio.accent.primary

### Bandwidth Optimization
- Maintain compatibility with JSX-to-template compilation
- Support compression for transmitted forms
- Preserve minimal DOM structure

## Migration Steps

1. **Create FormControl Wrapper**: Implement label/error integration
2. **Define Theme Variants**: Custom input styling in theme
3. **Write Tests**: Form and accessibility tests (must fail initially)
4. **Implement Migration**: Replace original component
5. **Update Form Components**: Update all form usage
6. **Validate Integration**: Test with existing forms

## Success Criteria

- ✅ All form functionality preserved
- ✅ Enhanced accessibility (label association, error handling)
- ✅ Visual consistency maintained
- ✅ Performance targets met
- ✅ Integration with existing validation logic
- ✅ Dark theme compatibility
- ✅ Mobile responsiveness preserved