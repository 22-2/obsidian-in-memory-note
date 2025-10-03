# Implementation Plan

- [x] 1. Add data validation and integrity checking to DatabaseAPI





  - Add `validateSandboxData` method to check data structure integrity
  - Add `isOlderThanDays` helper method for age-based cleanup
  - Modify `getSandbox` to validate data before returning
  - Add debug logging for validation failures
  - _Requirements: 2.1, 2.2, 4.1_

- [x] 2. Implement immediate save functionality in DatabaseManager





  - Add `immediateSave` method that bypasses debounce for critical events
  - Modify `saveToDatabase` to add retry logic with MAX_RETRY_ATTEMPTS (3 attempts)
  - Add debug logging for save operations (success and retry attempts)
  - Add warn logging for final save failures
  - _Requirements: 1.1, 1.3, 1.4, 4.2_

- [ ] 3. Replace clearAllDeadSandboxes with age-based cleanup
  - Rename `clearAllDeadSandboxes` to `clearOldDeadSandboxes` in DatabaseManager
  - Implement 3-day retention logic using mtime comparison
  - Update method to only delete sandboxes older than 3 days without active views
  - Add debug logging for cleanup operations
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Update all references to use new cleanup method
  - Update PluginEventManager to call `clearOldDeadSandboxes` instead of `clearAllDeadSandboxes`
  - Update AppOrchestrator context to expose `clearOldDeadSandboxes`
  - Verify cleanup only runs at layout-ready event (startup)
  - _Requirements: 3.1, 3.4_

- [ ] 5. Integrate immediate save with critical lifecycle events
  - Modify `handleViewClosed` in PluginEventManager to use `immediateSave` before deletion
  - Modify `handleUnload` in PluginEventManager to use `immediateSave` for all views
  - Ensure immediate saves complete before view closure or plugin unload
  - Add debug logging for immediate save operations
  - _Requirements: 1.1, 1.3, 2.1, 2.3_

- [ ] 6. Add data validation on plugin startup
  - Modify DatabaseManager or relevant startup code to validate all sandbox data on load
  - Skip and log any corrupted sandbox data during restoration
  - Ensure plugin continues normal operation even with some corrupted data
  - _Requirements: 2.1, 2.2, 2.4_

- [ ] 7. Create E2E test file for data persistence scenarios
  - Create new E2E test file for testing auto-save and restore functionality
  - Add test case for normal save and restore flow
  - Add test case for immediate save on view close
  - Add test case for 3-day retention cleanup
  - Add test case for corrupted data handling
  - _Requirements: 1.1, 1.2, 2.1, 3.1_
