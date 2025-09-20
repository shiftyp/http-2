# Button Component Migration Contract

**Component**: Button
**Original**: `src/components/ui/Button.tsx`
**Target**: Chakra UI Button
**Priority**: High (foundational component)

## Original API Contract

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}
```

## Chakra UI Migration Contract

```typescript
import { Button as ChakraButton, ButtonProps as ChakraButtonProps } from '@chakra-ui/react';

interface MigratedButtonProps extends Omit<ChakraButtonProps, 'variant' | 'size'> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}
```

## Prop Mapping

| Original Prop | Chakra Prop | Transform | Notes |
|---------------|-------------|-----------|-------|
| `variant='primary'` | `variant='primary'` | Direct | Custom variant in theme |
| `variant='secondary'` | `variant='secondary'` | Direct | Custom variant in theme |
| `variant='success'` | `variant='success'` | Direct | Custom variant in theme |
| `variant='warning'` | `variant='warning'` | Direct | Custom variant in theme |
| `variant='danger'` | `variant='danger'` | Direct | Custom variant in theme |
| `variant='info'` | `variant='info'` | Direct | Custom variant in theme |
| `size` | `size` | Direct | Matches Chakra sizes |
| `fullWidth` | `width='full'` | Transform | Boolean → width value |
| `className` | `className` | Direct | Preserved for override |
| `disabled` | `isDisabled` | Rename | Chakra naming convention |

## Visual Requirements

### Variant Styles (preserved from original)
- **Primary**: Blue background (`#3b82f6`), white text
- **Secondary**: Gray background (`#6b7280`), white text
- **Success**: Green background (`#10b981`), white text
- **Warning**: Yellow background (`#f59e0b`), white text
- **Danger**: Red background (`#ef4444`), white text
- **Info**: Cyan background (`#06b6d4`), white text
- **Ghost**: Transparent background, radio.text.primary text

### Size Variants
- **sm**: `padding: 12px 16px`, `font-size: 14px`
- **md**: `padding: 16px 20px`, `font-size: 16px` (default)
- **lg**: `padding: 24px 32px`, `font-size: 18px`

### Interactive States
- **Hover**: Darker shade of variant color
- **Active**: Even darker shade with slight scale
- **Focus**: Ring with variant color, keyboard accessible
- **Disabled**: 50% opacity, no interactions

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- ✅ Color contrast ratio ≥ 4.5:1 for all variants
- ✅ Keyboard navigation support (Tab, Enter, Space)
- ✅ Screen reader support with proper ARIA labels
- ✅ Focus indicators visible and consistent

### Enhanced Features (via Chakra UI)
- Automatic ARIA attributes (`role="button"`)
- Keyboard event handling
- Focus management
- Screen reader announcements

## Performance Contract

### Bundle Size Impact
- **Before**: Custom Button component (~2KB)
- **After**: Chakra Button + theme config (~3KB)
- **Increase**: ~1KB (acceptable)

### Render Performance
- **Target**: No regression in render time
- **Measurement**: Component render < 16ms (60fps)
- **Memory**: No memory leaks in repeated renders

## Testing Contract

### Unit Tests Required
```typescript
describe('Button Migration', () => {
  test('renders all variant styles correctly', () => {});
  test('handles size props correctly', () => {});
  test('applies fullWidth styling', () => {});
  test('forwards DOM props correctly', () => {});
  test('maintains keyboard accessibility', () => {});
  test('supports custom className override', () => {});
});
```

### Visual Regression Tests
- All variant combinations
- All size combinations
- Hover/focus/active states
- Disabled state
- Mobile responsive behavior

### Accessibility Tests
- Screen reader announcement
- Keyboard navigation
- Focus indicator visibility
- Color contrast validation

## Migration Steps

1. **Create Theme Variants**: Define custom variants in Chakra theme
2. **Create Wrapper Component**: Implement prop mapping logic
3. **Write Tests**: Unit and accessibility tests (must fail initially)
4. **Implement Migration**: Replace original component
5. **Update Imports**: Update all usage locations
6. **Validate**: Run tests and visual regression checks

## Rollback Plan

If migration fails:
1. Revert to original Button component
2. Remove Chakra Button imports
3. Restore original test suite
4. Document lessons learned

## Success Criteria

- ✅ All existing functionality preserved
- ✅ Visual appearance identical to original
- ✅ Accessibility improved (ARIA attributes, focus management)
- ✅ Performance maintained or improved
- ✅ All tests passing
- ✅ TypeScript types maintained
- ✅ No breaking changes for consumers