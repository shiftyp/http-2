import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('Server Download Integration Flow', () => {
  let browser: Browser;
  let page: Page;
  let serverProcess: ChildProcess;
  const serverPort = 8090;
  const downloadDir = path.join(process.cwd(), 'test-downloads');

  beforeAll(async () => {
    // Create download directory
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    // Start signaling server
    serverProcess = spawn('node', [
      path.join(process.cwd(), 'signaling-server', 'server.js')
    ], {
      env: { ...process.env, PORT: serverPort.toString() },
      cwd: process.cwd()
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Launch browser
    browser = await chromium.launch();
    const context = await browser.newContext({
      acceptDownloads: true,
      downloadPath: downloadDir
    });
    page = await context.newPage();
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Clean up download directory
    if (fs.existsSync(downloadDir)) {
      fs.rmSync(downloadDir, { recursive: true });
    }
  });

  it('should display server download option in station setup', async () => {
    // Navigate to station setup
    await page.goto(`http://localhost:${serverPort}/station-setup`);
    
    // Look for server download section
    const downloadSection = await page.locator('[data-testid="server-download-section"]');
    await expect(downloadSection).toBeVisible();
    
    // Check for emergency preparedness messaging
    const message = await page.locator('text=/emergency preparedness/i');
    await expect(message).toBeVisible();
    
    const licenseText = await page.locator('text=/licensed stations.*encouraged/i');
    await expect(licenseText).toBeVisible();
  });

  it('should download server package when requested', async () => {
    await page.goto(`http://localhost:${serverPort}/station-setup`);
    
    // Click download button
    const downloadButton = await page.locator('button:has-text("Download Server Package")');
    await downloadButton.click();
    
    // Wait for download to start
    const download = await page.waitForEvent('download');
    
    // Verify download properties
    expect(download.suggestedFilename()).toMatch(/ham-radio-server.*\.zip/);
    
    // Save the download
    const downloadPath = path.join(downloadDir, download.suggestedFilename());
    await download.saveAs(downloadPath);
    
    // Verify file exists and has content
    expect(fs.existsSync(downloadPath)).toBe(true);
    const stats = fs.statSync(downloadPath);
    expect(stats.size).toBeGreaterThan(1000); // At least 1KB
  });

  it('should show download progress', async () => {
    await page.goto(`http://localhost:${serverPort}/station-setup`);
    
    // Start download
    const downloadButton = await page.locator('button:has-text("Download Server Package")');
    await downloadButton.click();
    
    // Check for progress indicator
    const progressBar = await page.locator('[data-testid="download-progress"]');
    await expect(progressBar).toBeVisible();
    
    // Wait for completion
    await page.waitForSelector('[data-testid="download-complete"]', {
      timeout: 30000
    });
    
    // Verify completion message
    const completeMessage = await page.locator('[data-testid="download-complete"]');
    await expect(completeMessage).toContainText(/download complete/i);
  });

  it('should handle download interruption gracefully', async () => {
    await page.goto(`http://localhost:${serverPort}/station-setup`);
    
    // Start download
    const downloadButton = await page.locator('button:has-text("Download Server Package")');
    await downloadButton.click();
    
    // Simulate network interruption
    await page.context().setOffline(true);
    
    // Check for error handling
    const errorMessage = await page.waitForSelector('[data-testid="download-error"]', {
      timeout: 5000
    });
    await expect(errorMessage).toBeVisible();
    
    // Restore network
    await page.context().setOffline(false);
    
    // Check for retry option
    const retryButton = await page.locator('button:has-text("Retry Download")');
    await expect(retryButton).toBeVisible();
  });

  it('should verify package integrity after download', async () => {
    await page.goto(`http://localhost:${serverPort}/station-setup`);
    
    // Download package
    const downloadButton = await page.locator('button:has-text("Download Server Package")');
    await downloadButton.click();
    
    const download = await page.waitForEvent('download');
    const downloadPath = path.join(downloadDir, download.suggestedFilename());
    await download.saveAs(downloadPath);
    
    // Wait for verification
    const verificationStatus = await page.waitForSelector(
      '[data-testid="integrity-verification"]',
      { timeout: 10000 }
    );
    
    await expect(verificationStatus).toContainText(/verified/i);
    
    // Check for checksum display
    const checksumDisplay = await page.locator('[data-testid="package-checksum"]');
    await expect(checksumDisplay).toBeVisible();
    const checksumText = await checksumDisplay.textContent();
    expect(checksumText).toMatch(/[a-f0-9]{64}/i);
  });

  it('should save deployment configuration', async () => {
    await page.goto(`http://localhost:${serverPort}/station-setup`);
    
    // Complete server download
    const downloadButton = await page.locator('button:has-text("Download Server Package")');
    await downloadButton.click();
    
    await page.waitForSelector('[data-testid="download-complete"]', {
      timeout: 30000
    });
    
    // Save configuration
    const saveButton = await page.locator('button:has-text("Save Configuration")');
    await saveButton.click();
    
    // Verify configuration saved
    const savedMessage = await page.waitForSelector(
      '[data-testid="config-saved"]',
      { timeout: 5000 }
    );
    await expect(savedMessage).toContainText(/configuration saved/i);
    
    // Check that server status is displayed
    const serverStatus = await page.locator('[data-testid="server-status"]');
    await expect(serverStatus).toBeVisible();
    await expect(serverStatus).toContainText(/ready for deployment/i);
  });
});