import { Command } from 'commander';
import { XMLChangeDetector } from './change-detector.js';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
    .name('AR Change Detector')
    .description('🏛️ Detects changes in XML files from the Portuguese Parliament')
    .version('1.0.0')


program
  .argument('[resources...]', 'Resource names to monitor (e.g., InformacaoBase, Iniciativas)')
  .option('-l, --leg <legislatures>', 'Comma-separated legislature Roman numerals (e.g., XV,XVI,XVII)')
  .option('-d, --data-dir <dir>', 'Data directory path', './data')
  .option('-c, --curr', "Use current legislature only")
  .action(async (resources: string[], options) => {
    const legislatureFilter = options.leg ? 
      options.leg.split(',').map((leg: string) => leg.trim().toUpperCase()) : [];
    
    if (options.curr && legislatureFilter.length !== 0) {
        console.warn('⚠️ --curr option is incompatible with --leg option. Use either one or the other.');
        return;
    }
    
    if (legislatureFilter.length > 0) {
      console.log(`📚 Legislature filter: ${legislatureFilter.join(', ')}`);
    }
    
    // Delete existing change report at the start of each run
    const reportPath = path.join(options.dataDir, 'change-report.json');
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
      console.log('🗑️ Cleared previous change report');
    }
    
    const detector = new XMLChangeDetector(
        "https://www.parlamento.pt/Cidadania/paginas/dadosabertos.aspx",
        resources,
        options.dataDir,
        legislatureFilter,
        options.curr
    );
    
    const initialTime = performance.now();
    try {
        const results = await detector.detectAllChanges();
      
        const changedResources = results.filter(r => r.changeResult.hasChanged);
      
        if (changedResources.length > 0) {
            console.log(`🔄 Found ${changedResources.length} changed XML files`);
        } else {
            console.log('✅ No changes detected in any XML files');
        }
    } catch (error) {
        console.error('❌ Monitoring error:', error);
        process.exit(1);
    } finally {
        console.log(`⏱️ Change detection completed in ${((performance.now() - initialTime) / 1000).toFixed(1)}s`);
    }
  });

program.parse();