# 🎯 CLI Usage Examples

## Basic Usage

```bash
# Monitor all resources
npm run run

# Monitor specific resources
npm run run -- Deputados
npm run run -- Deputados Sessoes Iniciativas

# Monitor specific legislatures for specific resources
npm run run -- InformacaoBase Iniciativas --leg I,II,VI
npm run run -- InformacaoBase --leg XV,XVI,XVII
```

## Legislature Filtering

You can filter which legislatures to scrape using the `--leg` flag followed by comma-separated Roman numerals:

```bash
# Monitor only legislatures I, II, and VI for InformacaoBase and Iniciativas
npm run run -- InformacaoBase Iniciativas --leg I,II,VI

# Monitor only the most recent legislatures (XV, XVI, XVII) for all resources
npm run run -- --leg XV,XVI,XVII

# Monitor legislature XV only for InformacaoBase
npm run run -- InformacaoBase --leg XV
```

### Available Legislatures

The system supports Roman numerals for legislatures:
- **I** to **XVII** (1st to 17th legislature)
- Use uppercase Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII, XIII, XIV, XV, XVI, XVII)

## Available Resources

Based on the URL pattern `/Cidadania/Paginas/DA<name>.aspx`:

- **InformacaoBase** - From `DAInformacaoBase.aspx`
- **Deputados** - From `DADeputados.aspx`
- **Sessoes** - From `DASessoes.aspx`
- **Iniciativas** - From `DAIniciativas.aspx`
- **Comissoes** - From `DAComissoes.aspx`
- **Intervencoes** - From `DAIntervencoes.aspx`
- **Votos** - From `DAVotos.aspx`

## Package.json Scripts

```bash
# Run all resources and legislatures
npm run run

# Run only InformacaoBase resource
npm run info

# Run specific resources and legislatures (predefined)
npm run specific
```

## Integration

The CLI can be integrated into:
- GitHub Actions workflows
- Cron jobs
- Docker containers
- CI/CD pipelines

Example GitHub Action:
```yaml
- name: Check for recent legislature changes
  run: npm run run -- Deputados Iniciativas --leg XV,XVI,XVII

- name: Check specific legislature changes
  run: npm run run -- InformacaoBase --leg I,II,VI
```
