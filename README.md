# 🔍 AR-Change-Detector

> **Monitor XML files for changes using Playwright** 🎭  
> Designed for AR's open data - triggers retrieval when resources update

## ✨ Features

- 🔄 **Smart Detection** - SHA256 hashing for efficient change detection
- 💾 **Space Efficient** - Only stores hash, not XML files
- 🌐 **URL Handling** - Supports relative and absolute URLs
- 🛡️ **Error Resilient** - Handles network issues gracefully
- 📁 **Configurable** - Custom data directory support

## 🚀 Quick Start

```bash
npm install
npm run run
```

## 📖 Usage

```typescript
import { XMLChangeDetector } from './src/change-detector';

const detector = new XMLChangeDetector("https://example.com/data-page");
const result = await detector.detectChanges('a[title="data.xml"]');

if (result.hasChanged) {
    console.log('🔄 XML file changed!', result.currentHash);
}
```

## 🧪 Testing

```bash
npm test                # Run tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

> [!NOTE]
> **89.36%** statement coverage | **73.91%** branch coverage

## 🔧 API

### `XMLChangeDetector(baseUrl, dataDir?)`
- `baseUrl` - Webpage containing XML links
- `dataDir` - Hash storage directory (default: `./data`)

### `detectChanges(selector)`
Returns `ChangeDetectionResult`:
```typescript
{
    hasChanged: boolean;
    currentHash: string;
    previousHash?: string;
    timestamp: string;
}
```

## 🔄 How It Works

1. 🌐 Navigate to webpage
2. 🎯 Find XML link with CSS selector
3. 📥 Download XML content
4. 🔒 Generate SHA256 hash
5. 🔍 Compare with stored hash
6. 💾 Update if changed

> [!TIP]
> Uses Playwright for reliable web automation and only stores hashes to save disk space

## 📦 Dependencies

- `playwright` - Web automation
- `typescript` - Type safety
- `jest` - Testing framework

## 📄 License

MIT