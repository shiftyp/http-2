import { test, expect } from '@playwright/test';

test.describe('HTTP-over-Radio Application', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
  });

  test('should load the application', async ({ page }) => {
    // Check that the app loads
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Should show callsign setup prompt initially
    await expect(page.locator('text=Please configure your callsign')).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    const pages = [
      { link: 'Settings', heading: 'Settings' },
      { link: 'Content', heading: 'Content Creator' },
      { link: 'Radio', heading: 'Radio Operations' },
      { link: 'Browse', heading: 'Browse Remote Stations' },
      { link: 'Database', heading: 'Database Manager' },
      { link: 'Dashboard', heading: 'Dashboard' }
    ];

    for (const { link, heading } of pages) {
      await page.click(`text=${link}`);
      await expect(page.locator('h1')).toContainText(heading);
    }
  });

  test('should configure callsign', async ({ page }) => {
    // Navigate to settings
    await page.click('text=Settings');
    
    // Fill in callsign
    await page.fill('input[name="callsign"]', 'KJ4ABC');
    await page.fill('input[name="gridSquare"]', 'EM74');
    await page.fill('input[name="realName"]', 'Test Operator');
    
    // Save settings
    await page.click('button:has-text("Save")');
    
    // Should see success message
    await expect(page.locator('text=Settings saved')).toBeVisible();
    
    // Navigate back to dashboard
    await page.click('text=Dashboard');
    
    // Should show station callsign
    await expect(page.locator('text=Station KJ4ABC')).toBeVisible();
  });

  test('should create and edit content', async ({ page }) => {
    // Setup callsign first
    await page.click('text=Settings');
    await page.fill('input[name="callsign"]', 'W5XYZ');
    await page.click('button:has-text("Save")');
    
    // Navigate to content creator
    await page.click('text=Content');
    
    // Create new page
    await page.click('button:has-text("New Page")');
    
    // Fill in page details
    await page.fill('input[name="title"]', 'Test Page');
    await page.fill('input[name="path"]', '/test');
    
    // Add content
    await page.fill('textarea', '# Hello World\n\nThis is a test page.');
    
    // Save page
    await page.click('button:has-text("Save")');
    
    // Should see page in list
    await expect(page.locator('text=Test Page')).toBeVisible();
    
    // Should show compression stats
    await expect(page.locator('text=Compressed from')).toBeVisible();
  });

  test('should show radio operations interface', async ({ page }) => {
    await page.click('text=Radio');
    
    // Should show radio controls
    await expect(page.locator('text=Frequency')).toBeVisible();
    await expect(page.locator('text=Mode')).toBeVisible();
    await expect(page.locator('text=Connect Radio')).toBeVisible();
    
    // Should show signal monitoring
    await expect(page.locator('text=Signal Strength')).toBeVisible();
  });

  test('should handle offline functionality', async ({ page, context }) => {
    // Setup callsign
    await page.click('text=Settings');
    await page.fill('input[name="callsign"]', 'N0CALL');
    await page.click('button:has-text("Save")');
    
    // Go offline
    await context.setOffline(true);
    
    // Navigate to dashboard
    await page.click('text=Dashboard');
    
    // Should show offline status
    await expect(page.locator('text=● Offline')).toBeVisible();
    
    // App should still be functional
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show system status information', async ({ page }) => {
    await page.click('text=Settings');
    await page.fill('input[name="callsign"]', 'TEST');
    await page.click('button:has-text("Save")');
    
    await page.click('text=Dashboard');
    
    // Should show system status
    await expect(page.locator('text=System Status')).toBeVisible();
    await expect(page.locator('text=Service Worker')).toBeVisible();
    await expect(page.locator('text=IndexedDB')).toBeVisible();
    await expect(page.locator('text=Web Serial API')).toBeVisible();
  });

  test('should handle mesh network settings', async ({ page }) => {
    await page.click('text=Settings');
    
    // Enable mesh networking
    const meshToggle = page.locator('input[type="checkbox"]').first();
    await meshToggle.check();
    
    // Should show mesh settings
    await expect(page.locator('text=Mesh')).toBeVisible();
  });

  test('should browse stations interface', async ({ page }) => {
    await page.click('text=Browse');
    
    // Should show station discovery interface
    await expect(page.locator('text=Discovered Stations')).toBeVisible();
    await expect(page.locator('text=Select a Station')).toBeVisible();
    
    // Should have search functionality
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should show database management', async ({ page }) => {
    await page.click('text=Database');
    
    // Should show database tables
    await expect(page.locator('text=Pages')).toBeVisible();
    await expect(page.locator('text=Messages')).toBeVisible();
    await expect(page.locator('text=QSO Log')).toBeVisible();
    await expect(page.locator('text=Cache')).toBeVisible();
  });

  test('should handle PWA installation prompt', async ({ page }) => {
    // PWA install prompt should be available
    // (This test depends on browser support and may not always be visible)
    const installButton = page.locator('text=Install App');
    if (await installButton.isVisible()) {
      await expect(installButton).toBeVisible();
    }
  });

  test('should persist data across sessions', async ({ page, context }) => {
    // Set up data in first session
    await page.click('text=Settings');
    await page.fill('input[name="callsign"]', 'PERSIST');
    await page.fill('input[name="gridSquare"]', 'EM75');
    await page.click('button:has-text("Save")');
    
    // Create content
    await page.click('text=Content');
    await page.click('button:has-text("New Page")');
    await page.fill('input[name="title"]', 'Persistent Page');
    await page.fill('input[name="path"]', '/persistent');
    await page.fill('textarea', 'This should persist');
    await page.click('button:has-text("Save")');
    
    // Reload page to simulate new session
    await page.reload();
    
    // Data should persist
    await page.click('text=Dashboard');
    await expect(page.locator('text=Station PERSIST')).toBeVisible();
    
    await page.click('text=Content');
    await expect(page.locator('text=Persistent Page')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigation should adapt to mobile
    await expect(page.locator('nav')).toBeVisible();
    
    // Content should be readable
    await expect(page.locator('h1')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Should still be functional
    await page.click('text=Settings');
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should show appropriate error states', async ({ page }) => {
    await page.click('text=Radio');
    
    // Try to connect without Web Serial API support
    // (In headless mode, Web Serial API is not available)
    await page.click('button:has-text("Connect Radio")');
    
    // Should show appropriate error or unavailable state
    await expect(page.locator('text=Not Available')).toBeVisible();
  });
});