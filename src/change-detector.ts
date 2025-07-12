import { firefox } from 'playwright';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

interface Resource {
    identifier: string;
    url: string;
    title: string
}

interface Legislature {
    identifier: string;
    url: string;
    name: string; // e.g., "Pasta XVII Legislatura"
    resourceIdentifier: string; // Parent resource identifier
}

interface XMLFile {
    identifier: string;
    url: string;
    filename: string;
    legislatureIdentifier: string;
    resourceIdentifier: string;
    resourceName: string;
    // Store additional info for report generation
    resourceTitle: string;
    resourceUrl: string;
    legislatureName: string;
    legislatureUrl: string;
}

interface ChangeDetectionResult {
    hasChanged: boolean;
    currentHash: string;
    previousHash?: string;
    timestamp: string;
}

interface XMLFileChangeResult {
    xmlFile: XMLFile;
    changeResult: ChangeDetectionResult;
}

// Simplified change report format: { "ResourceName": { "XVII": "https://url-to-xml", "XII": "https://url-to-xml" } }
interface ChangeReport {
    [resourceName: string]: {
        [legislatureRomanNumeral: string]: string;
    };
}

class XMLChangeDetector {
    private baseUrl: string;
    private dataDir: string;
    private resourceNames: string[];
    private legislatureFilter: string[];
    private currentLegislature: boolean = false;

    constructor(baseUrl: string, resourceNames: string[] = [], dataDir: string = './data', legislatureFilter: string[] = [], currentLegislature: boolean = false) {
        this.baseUrl = baseUrl;
        this.resourceNames = resourceNames;
        this.dataDir = dataDir;
        this.legislatureFilter = legislatureFilter;
        this.currentLegislature = currentLegislature;
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    /**
     * Discovers all resources on the page
     */
    private async discoverResources(page: any): Promise<Resource[]> {
        await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
        
        console.log('Discovering resources on:', await page.title());
        
        // Find all resource links
        const resourceElements = await page.$$eval('a[title="Recursos"]', (links: any[]) => 
            links.map((link: any) => ({
                href: link.getAttribute('href') || '',
                title: link.getAttribute('href').split("/")[3] || '',
                outerHTML: link.outerHTML
            }))
        );
        
        console.log(`Found ${resourceElements.length} resources`);
        
        // Convert to Resource objects
        const resources: Resource[] = resourceElements.map((element: any) => {
            // Generate identifier from HTML element hash
            const identifier = crypto
                .createHash('sha256')
                .update(element.outerHTML)
                .digest('hex')
                .substring(0, 12); // Use first 12 chars for shorter identifier
            
            // Handle relative URLs
            let url = element.href;
            if (url && !url.startsWith('http')) {
                url = new URL(url, this.baseUrl).toString();
            }
            
            console.log(`Title: ${element.title}`);
            return {
                identifier,
                url,
                title: element.title
            };
        });
        
        // Filter resources based on provided resource names if list is not empty
        const filteredResources = this.resourceNames.length > 0 
            ? resources.filter(resource => {
                // Extract resource name from URL path like "/Cidadania/Paginas/DA<name>.aspx"
                const urlPath = resource.url.split('/').pop() || '';
                const match = urlPath.match(/^DA(.+)\.aspx$/);
                if (match) {
                    const resourceName = match[1];
                    return this.resourceNames.includes(resourceName);
                }
                return false;
            })
            : resources;
        
        console.log(`Filtered to ${filteredResources.length} resources based on provided names`);
        console.log('Resources to be retrieved:');
        for (const resource of filteredResources) {
            console.log(`  - ${resource.title}`);
        }
        
        return filteredResources;
    }

    /**
     * Discovers all legislatures for a specific resource
     */
    private async discoverLegislatures(page: any, resource: Resource): Promise<Legislature[]> {
        await page.goto(resource.url, { waitUntil: 'networkidle' });
        
        console.log(`Discovering legislatures for resource: ${resource.title}`);
        
        // Find all legislature folders (links containing "Pasta" and "Legislatura")
        let legislatureElements: string[] = await page.$$eval('a', (links: any[]) => 
            links.filter((link: any) => {
                const title = link.getAttribute('title') || '';
                const href = link.getAttribute('href') || '';

                // Match titles like "Pasta XX Legislatura" where XX are uppercase letters
                return /^Pasta [A-Z]+ Legislatura$/.test(title) && href;
            }).map((link: any) => ({
                href: link.getAttribute('href') || '',
                text: link.textContent?.trim() || '',
                title: link.getAttribute('title') || '',
                outerHTML: link.outerHTML
            }))
        );
        
        // If currentLegislature is true, filter to only the current legislature
        if (this.currentLegislature) {
            legislatureElements = legislatureElements[0] ? [legislatureElements[0]] : [];
        }

        console.log(`Found ${legislatureElements.length} legislatures for resource ${resource.identifier}`);
        
        // Convert to Legislature objects
        const legislatures: Legislature[] = legislatureElements.map((element: any) => {
            // Generate identifier from HTML element hash
            const identifier = crypto
                .createHash('sha256')
                .update(element.outerHTML)
                .digest('hex')
                .substring(0, 12);
            
            // Handle relative URLs
            let url = element.href;
            if (url && !url.startsWith('http')) {
                url = new URL(url, resource.url).toString();
            }
            
            // Use title if available, otherwise use text content
            const name = element.title || element.text;
            
            return {
                identifier,
                url,
                name,
                resourceIdentifier: resource.identifier
            };
        });
        
        // Filter legislatures based on provided filter if specified
        const filteredLegislatures = this.legislatureFilter.length > 0 
            ? legislatures.filter(legislature => {
                // Extract Roman numeral from legislature name (e.g., "Pasta XV Legislatura" -> "XV")
                const romanNumeralMatch = legislature.name.match(/\b([IVX]+)\b/);
                const romanNumeral = romanNumeralMatch ? romanNumeralMatch[1] : legislature.name;
                return this.legislatureFilter.includes(romanNumeral);
            })
            : legislatures;
        
        console.log(`Filtered to ${filteredLegislatures.length} legislatures based on filter`);
        if (this.legislatureFilter.length > 0) {
            console.log(`Legislature filter: ${this.legislatureFilter.join(', ')}`);
            console.log('Filtered legislatures:');
            for (const legislature of filteredLegislatures) {
                const romanNumeralMatch = legislature.name.match(/\b([IVX]+)\b/);
                const romanNumeral = romanNumeralMatch ? romanNumeralMatch[1] : legislature.name;
                console.log(`  - ${romanNumeral}: ${legislature.name}`);
            }
        }
        
        return filteredLegislatures;
    }

    /**
     * Discovers all XML files for a specific legislature
     */
    private async discoverXMLFiles(page: any, legislature: Legislature, resourceName: string, resource: Resource): Promise<XMLFile[]> {
        await page.goto(legislature.url, { waitUntil: 'networkidle' });
        
        // Find all XML file links
        const xmlElements = await page.$$eval('a', (links: any[]) => 
            links.filter((link: any) => {
                const href = link.getAttribute('href') || '';
                const title = link.getAttribute('title') || '';
                return href.includes('.xml') || title.includes('.xml');
            }).map((link: any) => ({
                href: link.getAttribute('href') || '',
                title: link.getAttribute('title') || '',
                text: link.textContent?.trim() || '',
                outerHTML: link.outerHTML
            }))
        );
        
        // Convert to XMLFile objects
        const xmlFiles: XMLFile[] = xmlElements.map((element: any) => {
            // Generate identifier from HTML element hash
            const identifier = crypto
                .createHash('sha256')
                .update(element.outerHTML)
                .digest('hex')
                .substring(0, 12);
            
            // Handle relative URLs
            let url = element.href;
            if (url && !url.startsWith('http')) {
                url = new URL(url, legislature.url).toString();
            }
            
            // Extract filename from URL or use title/text
            const filename = element.title || element.text || url.split('/').pop() || 'unknown.xml';
            console.log(`XML File: ${filename}`);
            
            return {
                identifier,
                url,
                filename,
                legislatureIdentifier: legislature.identifier,
                resourceIdentifier: legislature.resourceIdentifier,
                resourceName,
                // Store additional info for report generation
                resourceTitle: resource.title,
                resourceUrl: resource.url,
                legislatureName: legislature.name,
                legislatureUrl: legislature.url
            };
        });
        
        return xmlFiles;
    }

    /**
     * Detects changes for a specific XML file
     */
    private async detectXMLFileChanges(page: any, xmlFile: XMLFile): Promise<ChangeDetectionResult> {
        console.log(`Checking XML file: ${xmlFile.filename}`);
        
        // Download XML content
        const response = await page.goto(xmlFile.url);
        const content = await response?.text();
        
        if (!content) {
            throw new Error(`Failed to download XML content from ${xmlFile.url}`);
        }

        // Generate hash
        const currentHash = crypto.createHash('sha256').update(content).digest('hex');
        
        // Create resource-specific folder
        const resourceFolder = path.join(this.dataDir, xmlFile.resourceName);
        if (!fs.existsSync(resourceFolder)) {
            fs.mkdirSync(resourceFolder, { recursive: true });
        }
        
        const resourceNameLength = xmlFile.resourceName.length;
        const hashFile = path.join(resourceFolder, `${xmlFile.filename.slice(resourceNameLength)}_hash.txt`);
        
        // Check for changes
        let previousHash: string | undefined;
        let hasChanged = true;
        
        if (fs.existsSync(hashFile)) {
            previousHash = fs.readFileSync(hashFile, 'utf8').trim();
            hasChanged = currentHash !== previousHash;
        }
        
        // Save if changed
        if (hasChanged) {
            fs.writeFileSync(hashFile, currentHash);
            console.log(`✅ XML file ${xmlFile.filename} changed`);
        } else {
            console.log(`✅ XML file ${xmlFile.filename} unchanged`);
        }
        
        return {
            hasChanged,
            currentHash,
            previousHash,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Detects changes for all XML files across all resources and legislatures
     */
    async detectAllChanges(): Promise<XMLFileChangeResult[]> {
        const browser = await firefox.launch();
        const page = await browser.newPage();
        
        try {
            const resources = await this.discoverResources(page);
            const results: XMLFileChangeResult[] = [];
            
            for (const resource of resources) {
                try {
                    console.log(`\n📁 Processing resource: ${resource.title}`);
                    const legislatures = await this.discoverLegislatures(page, resource);
                    
                    // Extract resource name from title for folder structure
                    const resourceName = resource.title.replace('DA', '').replace('.aspx', '');
                    
                    for (const legislature of legislatures) {
                        try {
                            console.log(`\n📂 Processing legislature: ${legislature.name}`);
                            const xmlFiles = await this.discoverXMLFiles(page, legislature, resourceName, resource);
                            
                            for (const xmlFile of xmlFiles) {
                                try {
                                    const changeResult = await this.detectXMLFileChanges(page, xmlFile);
                                    results.push({
                                        xmlFile,
                                        changeResult
                                    });
                                } catch (error) {
                                    console.error(`Error checking XML file ${xmlFile.filename}:`, error);
                                }
                            }
                        } catch (error) {
                            console.error(`Error checking legislature ${legislature.name}:`, error);
                        }
                    }
                } catch (error) {
                    console.error(`Error checking resource ${resource.title}:`, error);
                }
            }
            
            // Generate change report for files that actually changed
            await this.generateChangeReport(results);
            
            return results;
            
        } finally {
            await browser.close();
        }
    }

    /**
     * Generates a simplified change report showing legislature Roman numerals and their XML URLs
     */
    private async generateChangeReport(results: XMLFileChangeResult[]): Promise<void> {
        const changedResults = results.filter(r => r.changeResult.hasChanged);
        const reportPath = path.join(this.dataDir, 'change-report.json');

        if (changedResults.length === 0) {
            console.log('📝 No changes detected - no report will be generated');
            fs.writeFileSync(reportPath, JSON.stringify({}, null, 2));
            return;
        }

        // Group changes by resource name and legislature Roman numeral
        const changeReport: ChangeReport = {};
        
        for (const result of changedResults) {
            const resourceName = result.xmlFile.resourceName;
            const legislatureName = result.xmlFile.legislatureName;
            const xmlUrl = result.xmlFile.url;
            
            // Extract Roman numeral from legislature name (e.g., "Pasta XV Legislatura" -> "XV")
            const romanNumeralMatch = legislatureName.match(/\b([IVX]+)\b/);
            const romanNumeral = romanNumeralMatch ? romanNumeralMatch[1] : legislatureName;
            
            // Initialize resource object if it doesn't exist
            if (!changeReport[resourceName]) {
                changeReport[resourceName] = {};
            }
            
            // Store the XML URL for this legislature (will overwrite if multiple files for same legislature)
            changeReport[resourceName][romanNumeral] = xmlUrl;
        }

        // Save the change report
        fs.writeFileSync(reportPath, JSON.stringify(changeReport, null, 2));
    }
}

// Export the class and interfaces for external use
export { XMLChangeDetector, ChangeDetectionResult, Resource, Legislature, XMLFile, XMLFileChangeResult, ChangeReport };