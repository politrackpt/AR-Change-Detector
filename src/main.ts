import { XMLChangeDetector } from './change-detector.js';

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
    
    const detector = new XMLChangeDetector(
        "https://www.parlamento.pt/Cidadania/paginas/dadosabertos.aspx",
        resourceNames
    );
    
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
        
        console.log(`📊 Total XML files checked: ${results.length}`);
        
    } catch (error) {
        console.error('❌ Monitoring error:', error);
    }
})();