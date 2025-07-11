# 🔍 AR-Change-Detector

> **Monitor XML files for changes using Playwright** 🎭  
> Designed for Portuguese Parliament's open data - triggers retrieval when resources update

## ✨ Features

- 🔄 **Smart Detection** - SHA256 hashing for efficient change detection
- 💾 **Space Efficient** - Only stores hash, not XML files
- 🌐 **Multi-level Discovery** - Discovers Resources → Legislatures → XML files
- 🛡️ **Error Resilient** - Handles network issues gracefully
- 📁 **Configurable** - Custom data directory support
- 🎯 **Selective Monitoring** - Monitor specific resources via CLI

## 🚀 Quick Start

```bash
npm install
npm run run                          # Monitor all resources
npm run run -- Deputados Sessoes    # Monitor specific resources
```

## 📖 Usage

### CLI Usage
```bash
# Monitor all resources
npm run run

# Monitor specific resources (resource names from URL paths)
npm run run -- Deputados Sessoes Iniciativas

# Examples of resource names:
# - Deputados (from /Cidadania/Paginas/DADeputados.aspx)
# - Sessoes (from /Cidadania/Paginas/DASessoes.aspx)
# - Iniciativas (from /Cidadania/Paginas/DAIniciativas.aspx)
```

## 🧪 Testing

```bash
npm test                # Run tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

## 🔧 API

### `XMLChangeDetector(baseUrl, resourceNames?, dataDir?)`
- `baseUrl` - Webpage containing XML links
- `resourceNames` - Array of resource names to monitor (optional, monitors all if empty)
- `dataDir` - Hash storage directory (default: `./data`)

### `detectAllChanges()`
Returns `XMLFileChangeResult[]`:
```typescript
{
    xmlFile: XMLFile;
    changeResult: ChangeDetectionResult;
}[]
```

### Resource Name Extraction
Resource names are extracted from URLs with pattern `/Cidadania/Paginas/DA<name>.aspx`:
- `DADeputados.aspx` → `Deputados`
- `DASessoes.aspx` → `Sessoes`
- `DAIniciativas.aspx` → `Iniciativas`

## 🔄 How It Works

1. 🌐 Navigate to Portuguese Parliament open data page
2. 🎯 Discover resources (optionally filtered by provided names)
3. 📁 For each resource, discover legislatures
4. 📂 For each legislature, discover XML files
5. 📥 Download XML content for each file
6. 🔒 Generate SHA256 hash
7. 🔍 Compare with stored hash
8. 💾 Update if changed

> [!NOTE]
> Uses single browser instance for performance and only stores hashes to save disk space

## 📦 Dependencies

- `playwright` - Web automation
- `typescript` - Type safety
- `jest` - Testing framework
