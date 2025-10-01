# Internationalization (i18n) System

This project uses a custom i18n system for managing translations.

## Usage

Import the `t` function from the i18n module:

```typescript
import { t } from "../i18n";
```

Use dot notation to access nested translation keys:

```typescript
// Simple text
const title = t("settings.sections.appearance");

// Text with parameters
const message = t("notices.convertedToFile", { 
  title: "My Note", 
  path: "/path/to/file.md" 
});
```

## Translation File Structure

Translation files are located in `src/i18n/` and follow this structure:

```json
{
  "commands": {
    "openHotSandboxNote": "Open new hot sandbox note",
    "convertToFile": "Convert to file"
  },
  "notices": {
    "convertedToFile": "{{title}} converted to file: {{path}}"
  }
}
```

## Parameter Interpolation

Use `{{paramName}}` syntax in translation strings for dynamic content:

```json
{
  "welcome": "Hello {{name}}, you have {{count}} messages"
}
```

```typescript
const message = t("welcome", { name: "John", count: 5 });
// Result: "Hello John, you have 5 messages"
```

## Adding New Languages

1. Create a new JSON file in `src/i18n/` (e.g., `ja.json`)
2. Copy the structure from `en.json` and translate the values
3. Import and add it to the translations object in `index.ts`:

```typescript
import en from "./en.json";
import ja from "./ja.json";

const translations: Record<string, any> = {
  en,
  ja,
};
```

## Language Detection

Currently defaults to English. To add language detection:

```typescript
// Detect Obsidian's language setting
const obsidianLang = this.app.vault.getConfig("language") || "en";
setLanguage(obsidianLang);
```