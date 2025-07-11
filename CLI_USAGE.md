# 🎯 CLI Usage Examples

## Basic Usage

```bash
# Monitor all resources
npm run run

# Monitor specific resources
npm run run -- Deputados
npm run run -- Deputados Sessoes Iniciativas
```

## Available Resources

Based on the URL pattern `/Cidadania/Paginas/DA<name>.aspx`:

- **Deputados** - From `DADeputados.aspx`
- **Sessoes** - From `DASessoes.aspx`
- **Iniciativas** - From `DAIniciativas.aspx`
- **Comissoes** - From `DAComissoes.aspx`
- **Intervencoes** - From `DAIntervencoes.aspx`
- **Votos** - From `DAVotos.aspx`

## Example Output

```
🔍 Starting change detection for resources: Deputados, Sessoes
📁 Processing resource: Deputados
📂 Processing legislature: Pasta XV Legislatura
✅ XML file DeputadosXV.xml unchanged
🔄 Found 2 changed XML files:
  - DeputadosXVI.xml (a1b2c3d4e5f6)
    URL: https://www.parlamento.pt/...
    Hash: 9f8e7d6c5b4a...
    Legislature: b2c3d4e5f6a1
    Resource: a1b2c3d4e5f6
📊 Total XML files checked: 45
```

## Integration

The CLI can be integrated into:
- GitHub Actions workflows
- Cron jobs
- Docker containers
- CI/CD pipelines

Example GitHub Action:
```yaml
- name: Check for changes
  run: npm run run -- Deputados Iniciativas
```
