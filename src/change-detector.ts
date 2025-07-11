import { firefox } from 'playwright';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

interface ChangeDetectionResult {
    hasChanged: boolean;
    currentHash: string;
    previousHash?: string;
    timestamp: string;
}

class XMLChangeDetector {
    private baseUrl: string;
    private dataDir: string;

    constructor(baseUrl: string, dataDir: string = './data') {
        this.baseUrl = baseUrl;
        this.dataDir = dataDir;
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    async detectChanges(xmlSelector: string): Promise<ChangeDetectionResult> {
        const browser = await firefox.launch();
        const page = await browser.newPage();
        
        try {
            await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
            
            console.log('Navigated to:', await page.title());

            await page.waitForTimeout(2000); // Wait for 2 seconds to ensure the page is fully loaded

            // Debug: Try to find any XML-related links
            const xmlLinks = await page.$$eval('a', links => 
                links.filter(link => {
                    const title = link.getAttribute('title') || '';
                    const href = link.getAttribute('href') || '';
                    return title.includes('xml') || href.includes('xml');
                }).map(link => ({
                    title: link.getAttribute('title'),
                    href: link.getAttribute('href'),
                    text: link.textContent?.trim()
                }))
            );
            console.log('XML-related links:', xmlLinks);
            
            // Find the XML link
            const xmlLink = page.locator(xmlSelector).first();
            const elementCount = await page.locator(xmlSelector).count();
            console.log(`Found ${elementCount} elements matching selector: ${xmlSelector}`);

            if (elementCount === 0) {
                throw new Error(`No elements found with selector: ${xmlSelector}`);
            }

            let xmlUrl = await xmlLink.getAttribute('href');
            
            // Handle relative URLs
            if (xmlUrl && !xmlUrl.startsWith('http')) {
                xmlUrl = new URL(xmlUrl, this.baseUrl).toString();
            }
            
            if (!xmlUrl) {
                throw new Error('XML link not found');
            }
            
            // Download XML content
            const response = await page.goto(xmlUrl);
            const xmlContent = await response?.text();
            
            if (!xmlContent) {
                throw new Error('Failed to download XML content');
            }

            // Generate hash
            const currentHash = crypto.createHash('sha256').update(xmlContent).digest('hex');
            const hashFile = path.join(this.dataDir, 'xml_hash.txt');
            
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
            }
            
            return {
                hasChanged,
                currentHash,
                previousHash,
                timestamp: new Date().toISOString()
            };
            
        } finally {
            await browser.close();
        }
    }
}

// Export the class for external use
export { XMLChangeDetector, ChangeDetectionResult };