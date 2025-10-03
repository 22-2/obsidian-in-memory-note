# Design Document

## Overview

VSCodeのhot exitのような信頼できる自動保存・復元システムを実装します。現在のDexie（IndexedDB）ベースのDatabaseManagerを拡張し、確実な自動保存、透明な復元、そして3日間のデータ保持機能を提供します。

## Architecture

### Current System Analysis

現在のシステムは以下の構造を持っています：

- **AppOrchestrator**: 全体の管理とマネージャーの調整
- **DatabaseManager**: データベース操作とデバウンス保存の管理
- **DatabaseAPI**: Dexieを使用したIndexedDB操作
- **EventEmitter**: アプリケーション全体のイベント管理

### Enhanced Architecture

既存のアーキテクチャを最小限の変更で強化します：

```
┌─────────────────────────────────────────────────────────────┐
│                    AppOrchestrator                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ DatabaseManager │  │   ViewManager   │  │ObsidianEvent│  │
│  │                 │  │                 │  │   Manager   │  │
│  │ • 300ms debounce│  │ • View tracking │  │             │  │
│  │ • Write confirm │  │ • Lifecycle     │  │• active-leaf│  │
│  │ • Smart cleanup │  │                 │  │• window-close│  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│           │                                                 │
│  ┌─────────────────┐                                        │
│  │   DatabaseAPI   │                                        │
│  │                 │                                        │
│  │ • IndexedDB     │                                        │
│  │ • Simple retry  │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. DatabaseManager Modifications

既存のDatabaseManagerを最小限の変更で改善：

#### Auto-Save Enhancement with Priority
- 通常のタイピング時: 300msデバウンス
- 重要なイベント時: 即座に保存（デバウンスなし）
  - `view-closed`イベント
  - `plugin-unload`イベント
- 書き込み確認の追加
- シンプルなリトライ機能

#### Data Retention Management
- `clearAllDeadSandboxes`を`clearOldDeadSandboxes`に置き換え
- 3日間（72時間）の保持期間
- mtimeベースの年齢計算
- 起動時のみクリーンアップ実行

#### Save State Visibility
- 開発者向けログレベルでの保存確認
- ユーザーには透明（通知なし）

```typescript
// 既存メソッドの置き換え
clearOldDeadSandboxes(): Promise<void>; // clearAllDeadSandboxesの代替

// 既存メソッドの改良
debouncedSaveSandboxes(masterId: string, content: string): Promise<void>;

// 新しいメソッド
immediateSave(masterId: string, content: string): Promise<void>; // 即座保存用
```

### 2. DatabaseAPI Enhancements

既存のDatabaseAPIに最小限の機能追加：

```typescript
// 新しいヘルパーメソッド
isOlderThanDays(note: HotSandboxNoteData, days: number): boolean;
validateSandboxData(note: HotSandboxNoteData): boolean; // データ整合性チェック

// 既存メソッドの改良（内部的な確認機能追加）
saveSandbox(note: HotSandboxNoteData): Promise<string>;
getSandbox(id: string): Promise<HotSandboxNoteData | undefined>; // バリデーション追加
```

### 3. Existing Event System Integration

既存のAppEventsシステムを活用：

```typescript
// 既存のイベントを活用
'obsidian-active-leaf-changed': { view: AbstractNoteView | null };
'obsidian-layout-changed': void;
'plugin-unload': void;
'view-closed': { view: AbstractNoteView };
```

## Data Models

### Enhanced HotSandboxNoteData

現在のデータモデルは変更不要：

```typescript
interface HotSandboxNoteData {
  id: string;
  content: string;
  mtime: number; // 年齢計算に使用
}
```

### Configuration Constants

```typescript
const DATA_RETENTION_CONFIG = {
  RETENTION_DAYS: 3,
  RETENTION_MS: 3 * 24 * 60 * 60 * 1000, // 3日間のミリ秒
  AUTO_SAVE_DELAY: 300, // 300ms
  MAX_RETRY_ATTEMPTS: 3,
} as const;
```

## Error Handling

### Save Operation Error Handling

1. **Primary Save Failure**: シンプルなリトライ（最大3回）
2. **Persistent Failures**: ログ出力、ユーザーには透明
3. **Critical Failures**: 最小限のコンソール警告

### Error Recovery

```typescript
// シンプルなエラーハンドリング
async saveSandboxWithRetry(note: HotSandboxNoteData): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      await this.saveSandbox(note);
      logger.debug(`Sandbox saved successfully: ${note.id}`);
      return true;
    } catch (error) {
      if (attempt === MAX_RETRY_ATTEMPTS) {
        logger.warn('Failed to save after retries:', error);
        return false;
      }
      logger.debug(`Save attempt ${attempt} failed, retrying...`);
    }
  }
  return false;
}
```

### Data Integrity Validation

```typescript
// 起動時のデータ整合性チェック
async loadSandboxWithValidation(id: string): Promise<HotSandboxNoteData | null> {
  try {
    const data = await this.getSandbox(id);
    if (!data || !this.validateSandboxData(data)) {
      logger.warn(`Invalid sandbox data detected: ${id}, skipping...`);
      return null;
    }
    return data;
  } catch (error) {
    logger.warn(`Failed to load sandbox: ${id}`, error);
    return null;
  }
}

// バリデーション関数
validateSandboxData(note: HotSandboxNoteData): boolean {
  return (
    typeof note.id === 'string' &&
    typeof note.content === 'string' &&
    typeof note.mtime === 'number' &&
    note.mtime > 0
  );
}
```

## Testing Strategy

### Unit Tests (Optional)

- DatabaseManager の保存・復元ロジック
- データ保持期間の計算
- エラーハンドリングとリトライ機能

### Integration Tests (Optional)

- プラグインライフサイクルとの統合
- 実際のIndexedDBとの連携
- イベントシステムとの連携

### Manual Testing Scenarios

1. **Normal Operation**: 通常の保存・復元動作
2. **Crash Recovery**: 強制終了後の復元
3. **Data Retention**: 3日後のクリーンアップ
4. **Error Conditions**: ストレージ障害時の動作

## Implementation Approach

### Phase 1: Auto-Save Enhancement with Priority
- デバウンス時間を300msに調整
- 即座保存機能の追加（view-closed、plugin-unload用）
- 書き込み確認機能の追加
- シンプルなリトライロジックの実装
- 開発者向けログ出力の追加

### Phase 2: Data Integrity and Validation
- データ整合性チェック機能の追加
- 起動時のバリデーション実装
- 破損データの安全なスキップ処理

### Phase 3: Data Retention
- `clearAllDeadSandboxes`を`clearOldDeadSandboxes`に置き換え
- 3日間の年齢ベースクリーンアップ
- 起動時のみ実行するように調整
- 既存の呼び出し箇所の更新

### Phase 4: Event System Integration
- view-closedイベントでの即座保存
- plugin-unloadイベントでの最終保存
- 既存のAppEventsシステムの活用

## Performance Considerations

- **Debounce Optimization**: 300ms間隔での効率的な保存（Obsidian標準に準拠）
- **Priority-based Save**: 重要なイベント時は即座保存でデータ損失を防止
- **Validation Overhead**: 起動時のみバリデーション実行で通常動作への影響を最小化
- **Background Cleanup**: 起動時の非同期クリーンアップ

## Security Considerations

- **Data Validation**: 保存前のデータ検証
- **Error Information**: エラーログでの機密情報の除外
- **Storage Limits**: ブラウザストレージ制限の考慮