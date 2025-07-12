import { XMLChangeDetector } from './change-detector.js';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments for resource names
const args = process.argv.slice(2);
const resourceNames = args.length > 0 ? args : [];

// Run change detection for specified resources (or all if none specified)
(async () => {
    if (resourceNames.length > 0) {
        console.log(`🔍 Starting change detection for resources: ${resourceNames.join(', ')}`);
    } else {
        console.log('🔍 Starting change detection for all resources...');
    }
    
    // Delete existing change report at the start of each run
    const reportPath = path.join("./data", 'change-report.json');
    if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
        console.log('🗑️ Cleared previous change report');
    }
    

    const detector = new XMLChangeDetector(
        "https://www.parlamento.pt/Cidadania/paginas/dadosabertos.aspx",
        resourceNames
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