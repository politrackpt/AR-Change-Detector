import { XMLChangeDetector, ChangeDetectionResult } from '../src/change-detector';
import * as fs from 'fs';
import * as path from 'path';

// Mock playwright
jest.mock('playwright', () => ({
    firefox: {
        launch: jest.fn(),
    },
}));

describe('XMLChangeDetector', () => {
    let detector: XMLChangeDetector;
    const testDataDir = './test-data';
    const testUrl = 'https://example.com/test';
    
    // Mock browser and page
    let mockBrowser: any;
    let mockPage: any;
    let mockLocator: any;
    let mockResponse: any;
    
    beforeAll(async () => {
        // Clean up test data directory
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });

    beforeEach(async () => {
        // Setup mocks
        mockLocator = {
            first: jest.fn().mockReturnThis(),
            count: jest.fn().mockResolvedValue(1),
            getAttribute: jest.fn().mockResolvedValue('/test.xml'),
            textContent: jest.fn().mockResolvedValue('test.xml'),
        };

        mockResponse = {
            text: jest.fn().mockResolvedValue('<root><item>test content</item></root>'),
        };

        mockPage = {
            goto: jest.fn().mockResolvedValue(mockResponse),
            title: jest.fn().mockResolvedValue('Test Page'),
            waitForTimeout: jest.fn(),
            locator: jest.fn().mockReturnValue(mockLocator),
            $$eval: jest.fn().mockResolvedValue([{
                title: 'test.xml',
                href: '/test.xml',
                text: 'test.xml'
            }]),
            close: jest.fn(),
        };

        mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn(),
        };

        const { firefox } = require('playwright');
        (firefox.launch as jest.Mock).mockResolvedValue(mockBrowser);

        detector = new XMLChangeDetector(testUrl, testDataDir);
    });

    afterEach(async () => {
        // Clean up test data after each test
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
        jest.clearAllMocks();
    });

    afterAll(async () => {
        // Final cleanup
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });

    describe('Constructor', () => {
        it('should create instance with default data directory', () => {
            const det = new XMLChangeDetector(testUrl);
            expect(det).toBeInstanceOf(XMLChangeDetector);
        });

        it('should create instance with custom data directory', () => {
            const det = new XMLChangeDetector(testUrl, './custom-data');
            expect(det).toBeInstanceOf(XMLChangeDetector);
        });

        it('should create data directory if it does not exist', () => {
            const customDir = './test-custom-data';
            new XMLChangeDetector(testUrl, customDir);
            expect(fs.existsSync(customDir)).toBe(true);
            // Cleanup
            fs.rmSync(customDir, { recursive: true, force: true });
        });
    });

    describe('detectChanges', () => {
        it('should detect changes on first run (no previous hash)', async () => {
            const result = await detector.detectChanges('a[title="test.xml"]');

            expect(result.hasChanged).toBe(true);
            expect(result.currentHash).toBeDefined();
            expect(result.previousHash).toBeUndefined();
            expect(result.timestamp).toBeDefined();
            
            // Verify hash file was created
            const hashFile = path.join(testDataDir, 'xml_hash.txt');
            expect(fs.existsSync(hashFile)).toBe(true);
            
            // Verify browser interaction
            expect(mockBrowser.newPage).toHaveBeenCalled();
            expect(mockPage.goto).toHaveBeenCalledWith(testUrl, { waitUntil: 'networkidle' });
            expect(mockPage.locator).toHaveBeenCalledWith('a[title="test.xml"]');
            expect(mockBrowser.close).toHaveBeenCalled();
        });

        it('should detect no changes when content is the same', async () => {
            // First run
            const result1 = await detector.detectChanges('a[title="test.xml"]');
            expect(result1.hasChanged).toBe(true);

            // Second run with same content
            const result2 = await detector.detectChanges('a[title="test.xml"]');
            expect(result2.hasChanged).toBe(false);
            expect(result2.currentHash).toBe(result1.currentHash);
            expect(result2.previousHash).toBe(result1.currentHash);
        });

        it('should detect changes when content is different', async () => {
            // First run
            const result1 = await detector.detectChanges('a[title="test.xml"]');
            expect(result1.hasChanged).toBe(true);

            // Change the mock response for second run
            mockResponse.text.mockResolvedValue('<root><item>different content</item></root>');

            // Second run with different content
            const result2 = await detector.detectChanges('a[title="test.xml"]');
            expect(result2.hasChanged).toBe(true);
            expect(result2.currentHash).not.toBe(result1.currentHash);
            expect(result2.previousHash).toBe(result1.currentHash);
        });

        it('should throw error when XML link is not found', async () => {
            // Mock no elements found
            mockLocator.count.mockResolvedValue(0);

            await expect(detector.detectChanges('a[title="nonexistent.xml"]'))
                .rejects
                .toThrow('No elements found with selector: a[title="nonexistent.xml"]');
        });

        it('should throw error when XML link has no href attribute', async () => {
            // Mock no href attribute
            mockLocator.getAttribute.mockResolvedValue(null);

            await expect(detector.detectChanges('a[title="test.xml"]'))
                .rejects
                .toThrow('XML link not found');
        });

        it('should throw error when XML content cannot be downloaded', async () => {
            // Mock empty response
            mockResponse.text.mockResolvedValue('');

            await expect(detector.detectChanges('a[title="test.xml"]'))
                .rejects
                .toThrow('Failed to download XML content');
        });

        it('should handle relative URLs correctly', async () => {
            // Mock relative URL
            mockLocator.getAttribute.mockResolvedValue('./relative/test.xml');

            const result = await detector.detectChanges('a[title="test.xml"]');
            expect(result.hasChanged).toBe(true);
            expect(result.currentHash).toBeDefined();
            
            // Verify that goto was called twice - once for main page, once for XML
            expect(mockPage.goto).toHaveBeenCalledTimes(2);
            expect(mockPage.goto).toHaveBeenCalledWith(testUrl, { waitUntil: 'networkidle' });
            expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/relative/test.xml');
        });

        it('should handle empty XML content', async () => {
            // Mock empty but valid XML response
            mockResponse.text.mockResolvedValue('<?xml version="1.0"?><root></root>');

            const result = await detector.detectChanges('a[title="test.xml"]');
            expect(result.hasChanged).toBe(true);
            expect(result.currentHash).toBeDefined();
        });

        it('should not save XML files to disk (only hash)', async () => {
            await detector.detectChanges('a[title="test.xml"]');

            // Verify only hash file exists, no XML files
            const hashFile = path.join(testDataDir, 'xml_hash.txt');
            const xmlFile = path.join(testDataDir, 'latest.xml');
            
            expect(fs.existsSync(hashFile)).toBe(true);
            expect(fs.existsSync(xmlFile)).toBe(false);
            
            // Check for any XML files in the directory
            const files = fs.readdirSync(testDataDir);
            const xmlFiles = files.filter(file => file.endsWith('.xml'));
            expect(xmlFiles).toHaveLength(0);
        });

        it('should generate consistent hashes for same content', async () => {
            const result1 = await detector.detectChanges('a[title="test.xml"]');
            const result2 = await detector.detectChanges('a[title="test.xml"]');
            
            expect(result1.currentHash).toBe(result2.currentHash);
            expect(result2.hasChanged).toBe(false);
        });
    });

    describe('Hash File Management', () => {
        it('should create hash file with correct content', async () => {
            await detector.detectChanges('a[title="test.xml"]');

            const hashFile = path.join(testDataDir, 'xml_hash.txt');
            expect(fs.existsSync(hashFile)).toBe(true);
            
            // Verify file content
            const hashContent = fs.readFileSync(hashFile, 'utf8');
            expect(hashContent).toBeTruthy();
            expect(hashContent.length).toBeGreaterThan(0);
            // SHA256 hash should be 64 characters
            expect(hashContent.trim().length).toBe(64);
        });

        it('should handle corrupted hash file', async () => {
            // Create a corrupted hash file
            const hashFile = path.join(testDataDir, 'xml_hash.txt');
            fs.mkdirSync(testDataDir, { recursive: true });
            fs.writeFileSync(hashFile, 'corrupted-hash-content');

            // Should still work and detect changes
            const result = await detector.detectChanges('a[title="test.xml"]');
            expect(result.hasChanged).toBe(true);
            expect(result.previousHash).toBe('corrupted-hash-content');
        });

        it('should update hash file when content changes', async () => {
            // First run
            await detector.detectChanges('a[title="test.xml"]');
            
            const hashFile = path.join(testDataDir, 'xml_hash.txt');
            const firstHash = fs.readFileSync(hashFile, 'utf8').trim();

            // Change content and run again
            mockResponse.text.mockResolvedValue('<root><item>new content</item></root>');
            await detector.detectChanges('a[title="test.xml"]');

            const secondHash = fs.readFileSync(hashFile, 'utf8').trim();
            expect(secondHash).not.toBe(firstHash);
        });
    });

    describe('Error Handling', () => {
        it('should close browser on error', async () => {
            // Mock an error during page navigation
            mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

            await expect(detector.detectChanges('a[title="test.xml"]'))
                .rejects
                .toThrow('Navigation failed');
            
            // Verify browser was still closed
            expect(mockBrowser.close).toHaveBeenCalled();
        });

        it('should handle network errors gracefully', async () => {
            // Mock network error
            mockPage.goto.mockRejectedValueOnce(new Error('Network error'));

            await expect(detector.detectChanges('a[title="test.xml"]'))
                .rejects
                .toThrow('Network error');
        });
    });

    describe('Selector Handling', () => {
        it('should handle complex selectors', async () => {
            const complexSelector = 'a[title*="Iniciativas"][href*=".xml"]';
            
            await detector.detectChanges(complexSelector);
            
            expect(mockPage.locator).toHaveBeenCalledWith(complexSelector);
        });

        it('should handle multiple matching elements (uses first)', async () => {
            // Mock multiple matches
            mockLocator.count.mockResolvedValue(3);
            
            const result = await detector.detectChanges('a[title*=".xml"]');
            
            expect(result.hasChanged).toBe(true);
            expect(mockLocator.first).toHaveBeenCalled();
        });
    });
});
