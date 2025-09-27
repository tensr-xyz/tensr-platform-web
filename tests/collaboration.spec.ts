import { test, expect } from '@playwright/test';

test.describe('Collaboration Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page and ensure we're logged in
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we need to log in (you may need to adjust this based on your auth flow)
    if (await page.locator('[data-testid="login-button"]').isVisible()) {
      await page.click('[data-testid="login-button"]');
      // Add login logic here if needed
    }
  });

  test.describe('Session Management', () => {
    test('should create a new collaboration session', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Click create session button
      await page.click('[data-testid="create-session-button"]');
      
      // Fill in session details
      await page.fill('[data-testid="file-path-input"]', '/test/document.xlsx');
      await page.fill('[data-testid="file-name-input"]', 'Test Document');
      await page.fill('[data-testid="user-name-input"]', 'Test User');
      
      // Submit the form
      await page.click('[data-testid="create-session-submit"]');
      
      // Wait for success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Session created successfully');
      
      // Verify session appears in the list
      await expect(page.locator('[data-testid="session-list"]')).toContainText('Test Document');
    });

    test('should display all active collaboration sessions', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Wait for sessions to load
      await page.waitForSelector('[data-testid="session-list"]');
      
      // Verify sessions are displayed
      const sessionItems = page.locator('[data-testid="session-item"]');
      await expect(sessionItems).toHaveCount.greaterThan(0);
      
      // Check if session details are shown
      await expect(page.locator('[data-testid="session-owner"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-participants"]')).toBeVisible();
    });

    test('should join an existing collaboration session', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Wait for sessions to load
      await page.waitForSelector('[data-testid="session-list"]');
      
      // Find a session to join
      const firstSession = page.locator('[data-testid="session-item"]').first();
      const joinButton = firstSession.locator('[data-testid="join-session-button"]');
      
      // Click join button
      await joinButton.click();
      
      // Fill in user name if prompted
      if (await page.locator('[data-testid="join-session-modal"]').isVisible()) {
        await page.fill('[data-testid="user-name-input"]', 'New Participant');
        await page.click('[data-testid="join-session-submit"]');
      }
      
      // Verify successful join
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Joined session successfully');
    });

    test('should leave a collaboration session', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Wait for sessions to load
      await page.waitForSelector('[data-testid="session-list"]');
      
      // Find a session where user is a participant
      const userSession = page.locator('[data-testid="session-item"]').filter({ hasText: 'Test User' });
      const leaveButton = userSession.locator('[data-testid="leave-session-button"]');
      
      // Click leave button
      await leaveButton.click();
      
      // Confirm leave action if prompted
      if (await page.locator('[data-testid="confirm-leave-modal"]').isVisible()) {
        await page.click('[data-testid="confirm-leave-button"]');
      }
      
      // Verify successful leave
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Left session successfully');
    });

    test('should handle session creation validation errors', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Click create session button
      await page.click('[data-testid="create-session-button"]');
      
      // Try to submit without required fields
      await page.click('[data-testid="create-session-submit"]');
      
      // Verify validation errors
      await expect(page.locator('[data-testid="file-path-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-name-error"]')).toBeVisible();
    });

    test('should handle session not found error', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Try to access a non-existent session
      await page.goto('/collaboration/sessions/non-existent-session-id');
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Session not found');
    });
  });

  test.describe('Real-time Collaboration', () => {
    test('should establish WebSocket connection for real-time updates', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Join a session
      const firstSession = page.locator('[data-testid="session-item"]').first();
      await firstSession.locator('[data-testid="join-session-button"]').click();
      
      // Wait for WebSocket connection indicator
      await expect(page.locator('[data-testid="websocket-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Connected');
    });

    test('should show real-time presence updates', async ({ page, context }) => {
      // Create a second page context to simulate another user
      const secondPage = await context.newPage();
      
      // Both pages navigate to collaboration
      await page.goto('/collaboration');
      await secondPage.goto('/collaboration');
      
      // Both users join the same session
      await page.locator('[data-testid="join-session-button"]').first().click();
      await secondPage.locator('[data-testid="join-session-button"]').first().click();
      
      // Verify both users are shown as participants
      await expect(page.locator('[data-testid="participant-list"]')).toContainText('User 1');
      await expect(page.locator('[data-testid="participant-list"]')).toContainText('User 2');
      
      // Close second page
      await secondPage.close();
    });

    test('should handle WebSocket disconnection gracefully', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Join a session
      const firstSession = page.locator('[data-testid="session-item"]').first();
      await firstSession.locator('[data-testid="join-session-button"]').click();
      
      // Simulate network disconnection (you may need to adjust this based on your implementation)
      await page.evaluate(() => {
        // Simulate WebSocket close
        window.dispatchEvent(new Event('offline'));
      });
      
      // Verify disconnection is handled
      await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Disconnected');
      await expect(page.locator('[data-testid="reconnect-button"]')).toBeVisible();
    });

    test('should show real-time cursor positions', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Join a session
      const firstSession = page.locator('[data-testid="session-item"]').first();
      await firstSession.locator('[data-testid="join-session-button"]').click();
      
      // Navigate to the document view
      await page.click('[data-testid="open-document-button"]');
      
      // Move cursor around to trigger presence updates
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 200);
      
      // Verify cursor position is tracked
      await expect(page.locator('[data-testid="cursor-position"]')).toBeVisible();
    });

    test('should handle collaborative document editing', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Join a session
      const firstSession = page.locator('[data-testid="session-item"]').first();
      await firstSession.locator('[data-testid="join-session-button"]').click();
      
      // Open document for editing
      await page.click('[data-testid="open-document-button"]');
      
      // Wait for document to load
      await page.waitForSelector('[data-testid="document-editor"]');
      
      // Make an edit
      await page.click('[data-testid="cell-A1"]');
      await page.type('[data-testid="cell-input"]', 'Collaborative Edit');
      await page.press('[data-testid="cell-input"]', 'Enter');
      
      // Verify edit is saved
      await expect(page.locator('[data-testid="cell-A1"]')).toContainText('Collaborative Edit');
      
      // Verify edit is synced (this may require another user to verify)
      await expect(page.locator('[data-testid="sync-status"]')).toContainText('Synced');
    });
  });

  test.describe('Permission and Access Control', () => {
    test('should prevent unauthorized users from creating sessions', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Try to create session without proper permissions
      await page.click('[data-testid="create-session-button"]');
      
      // Fill in session details
      await page.fill('[data-testid="file-path-input"]', '/test/document.xlsx');
      await page.fill('[data-testid="file-name-input"]', 'Test Document');
      await page.fill('[data-testid="user-name-input"]', 'Test User');
      
      // Submit the form
      await page.click('[data-testid="create-session-submit"]');
      
      // Verify permission error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Insufficient permissions');
    });

    test('should prevent access to sessions user is not part of', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Try to access a session without joining
      const sessionItem = page.locator('[data-testid="session-item"]').first();
      const sessionId = await sessionItem.getAttribute('data-session-id');
      
      // Navigate directly to session
      await page.goto(`/collaboration/sessions/${sessionId}`);
      
      // Verify access denied
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Access denied');
    });

    test('should enforce organization membership requirements', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Try to create session without organization membership
      await page.click('[data-testid="create-session-button"]');
      
      // Fill in session details
      await page.fill('[data-testid="file-path-input"]', '/test/document.xlsx');
      await page.fill('[data-testid="file-name-input"]', 'Test Document');
      await page.fill('[data-testid="user-name-input"]', 'Test User');
      
      // Submit the form
      await page.click('[data-testid="create-session-submit"]');
      
      // Verify organization membership error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('organization membership');
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Simulate network error
      await page.route('**/sessions', route => route.abort());
      
      // Try to load sessions
      await page.reload();
      
      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should handle malformed session data', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Mock malformed API response
      await page.route('**/sessions', route => 
        route.fulfill({
          status: 200,
          body: 'invalid-json',
          headers: { 'content-type': 'application/json' }
        })
      );
      
      // Reload page
      await page.reload();
      
      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid data');
    });

    test('should handle concurrent session operations', async ({ page, context }) => {
      // Create multiple page contexts
      const page1 = page;
      const page2 = await context.newPage();
      const page3 = await context.newPage();
      
      // All pages navigate to collaboration
      await page1.goto('/collaboration');
      await page2.goto('/collaboration');
      await page3.goto('/collaboration');
      
      // All users try to join the same session simultaneously
      const joinPromises = [
        page1.locator('[data-testid="join-session-button"]').first().click(),
        page2.locator('[data-testid="join-session-button"]').first().click(),
        page3.locator('[data-testid="join-session-button"]').first().click(),
      ];
      
      await Promise.all(joinPromises);
      
      // Verify all users can join successfully
      await expect(page1.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page2.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page3.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Close additional pages
      await page2.close();
      await page3.close();
    });
  });

  test.describe('Performance and Scalability', () => {
    test('should handle large numbers of sessions efficiently', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Mock many sessions
      await page.route('**/sessions', route => 
        route.fulfill({
          status: 200,
          body: JSON.stringify(Array.from({ length: 100 }, (_, i) => ({
            id: `session-${i}`,
            fileName: `Document ${i}`,
            filePath: `/documents/doc-${i}.xlsx`,
            ownerId: `user-${i}`,
            ownerName: `User ${i}`,
            participantCount: Math.floor(Math.random() * 5) + 1,
            participants: [],
            created: new Date().toISOString(),
            lastActive: new Date().toISOString(),
          })),
          headers: { 'content-type': 'application/json' },
        })
      );
      
      // Reload page
      await page.reload();
      
      // Wait for sessions to load
      await page.waitForSelector('[data-testid="session-list"]');
      
      // Verify performance (should load within reasonable time)
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="session-item"]');
      const loadTime = Date.now() - startTime;
      
      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
      
      // Verify all sessions are displayed
      const sessionItems = page.locator('[data-testid="session-item"]');
      await expect(sessionItems).toHaveCount(100);
    });

    test('should handle WebSocket message flooding gracefully', async ({ page }) => {
      // Navigate to collaboration section
      await page.click('[data-testid="collaboration-tab"]');
      
      // Join a session
      const firstSession = page.locator('[data-testid="session-item"]').first();
      await firstSession.locator('[data-testid="join-session-button"]').click();
      
      // Simulate rapid message sending
      await page.evaluate(() => {
        // Send many messages rapidly
        for (let i = 0; i < 100; i++) {
          setTimeout(() => {
            // Simulate WebSocket message
            window.dispatchEvent(new CustomEvent('websocket-message', {
              detail: { type: 'presence_update', data: { userId: 'test', position: i } }
            }));
          }, i * 10);
        }
      });
      
      // Wait for processing
      await page.waitForTimeout(2000);
      
      // Verify system remains stable
      await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Connected');
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    });
  });
});
