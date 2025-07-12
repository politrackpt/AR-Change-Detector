import { XMLChangeDetector } from './change-detector.js';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);

// Parse resource names and legislature filter
let resourceNames: string[] = [];
let legislatureFilter: string[] = [];

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--leg' && i + 1 < args.length) {
        // Parse legislature filter: comma-separated Roman numerals
        legislatureFilter = args[i + 1].split(',').map(leg => leg.trim().toUpperCase());
        i++; // Skip the next argument as it's the legislature list
    } else if (!args[i].startsWith('--')) {
        // Regular resource name
        resourceNames.push(args[i]);
    }
}

// Run change detection for specified resources (or all if none specified)
(async () => {
    if (resourceNames.length > 0) {
        console.log(`🔍 Starting change detection for resources: ${resourceNames.join(', ')}`);
    } else {
        console.log('🔍 Starting change detection for all resources...');
    }
    
    if (legislatureFilter.length > 0) {
        console.log(`📚 Legislature filter: ${legislatureFilter.join(', ')}`);
    }
    
    // Delete existing change report at the start of each run
    const reportPath = path.join("./data", 'change-report.json');
    if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
        console.log('🗑️ Cleared previous change report');
    }
    

    const detector = new XMLChangeDetector(
        "https://www.parlamento.pt/Cidadania/paginas/dadosabertos.aspx",
        resourceNames,
        './data',
        legislatureFilter
    );
    
    const initialTime = performance.now();
    try {
        // Detect changes for specified resources
        const results = await detector.detectAllChanges();
        
        const changedResources = results.filter(r => r.changeResult.hasChanged);
        
        if (changedResources.length > 0) {
            console.log(`🔄 Found ${changedResources.length} changed XML files:`);
            
            console.log('📧 Sending notifications...');
            // Add your notification logic here (email, webhook, etc.)
        } else {
            console.log('✅ No changes detected in any XML files.');
        }
    } catch (error) {
        console.error('❌ Monitoring error:', error);
    } finally {
        console.log(`⏱️ Change detection completed in ${((performance.now() - initialTime) / 1000).toFixed(1)} s`);
    }
})();