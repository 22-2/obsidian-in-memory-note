# Requirements Document

## Introduction

hotsandboxのデータが強制終了やブラウザクラッシュで消失するリスクを解決するため、VSCodeのhot exitのような信頼できる自動保持システムを構築します。簡単に書いて、簡単に捨てられて、必要に応じてmdとして保存できる（既存機能）、でも絶対に消えない信頼できるシステムを提供します。

## Requirements

### Requirement 1

**User Story:** As a user, I want my hotsandbox content to be automatically and reliably saved as I type, so that I never lose my work even during unexpected crashes.

#### Acceptance Criteria

1. WHEN the user types in a sandbox note THEN the system SHALL automatically save the content to IndexedDB within 1 second
2. WHEN a save operation occurs THEN the system SHALL confirm the write was successful before proceeding
3. WHEN the browser/plugin is about to close THEN the system SHALL ensure all unsaved changes are persisted to IndexedDB
4. WHEN a save operation fails THEN the system SHALL retry the operation up to 3 times with exponential backoff

### Requirement 2

**User Story:** As a user, I want my hotsandbox content to be automatically restored when I restart the plugin, so that I can continue working exactly where I left off without any manual intervention.

#### Acceptance Criteria

1. WHEN the plugin starts THEN the system SHALL automatically restore all sandbox data from IndexedDB silently
2. WHEN IndexedDB is unavailable or corrupted THEN the system SHALL start with empty state and log the issue
3. WHEN restoration completes successfully THEN the system SHALL continue normal operation without user notification
4. WHEN restoration fails THEN the system SHALL start with empty state and show a minimal warning

### Requirement 3

**User Story:** As a user, I want my closed sandbox notes to be retained for a reasonable period, so that I can recover accidentally closed work without losing it immediately.

#### Acceptance Criteria

1. WHEN a sandbox note is closed or no longer has an active view THEN the system SHALL retain the data for at least 3 days
2. WHEN the system performs cleanup operations THEN it SHALL only delete sandbox data older than 3 days
3. WHEN calculating data age THEN the system SHALL use the last modified time (mtime) of the sandbox note
4. WHEN cleanup runs THEN the system SHALL preserve all sandbox data that has been modified within the last 3 days

### Requirement 4

**User Story:** As a user, I want the system to handle database issues gracefully, so that my writing experience is never interrupted by technical problems.

#### Acceptance Criteria

1. WHEN IndexedDB write operations fail THEN the system SHALL keep unsaved data in memory and retry periodically
2. WHEN IndexedDB becomes available again THEN the system SHALL automatically persist all pending data
3. WHEN persistent database issues occur THEN the system SHALL continue operating with in-memory storage
4. WHEN critical database issues occur THEN the system SHALL show a minimal, non-intrusive warning about potential data loss