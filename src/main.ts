import { XMLChangeDetector } from './change-detector';

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
            
            changedResources.forEach(result => {
                console.log(`  - ${result.xmlFile.filename} (${result.xmlFile.identifier})`);
                console.log(`    URL: ${result.xmlFile.url}`);
                console.log(`    Hash: ${result.changeResult.currentHash.substring(0, 12)}...`);
                console.log(`    Legislature: ${result.xmlFile.legislatureIdentifier}`);
                console.log(`    Resource: ${result.xmlFile.resourceIdentifier}`);
            });
            
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