import { XMLChangeDetector } from '../src/change-detector';
import * as fs from 'fs';

// Mock Playwright
jest.mock('playwright', () => ({
    firefox: {
        launch: jest.fn()
    }
}));

describe('XMLChangeDetector - New Multi-level API', () => {
    let detector: XMLChangeDetector;
    const testUrl = 'https://example.com/test';
    const testDataDir = './test-data';

    // Mock browser and page
    const mockPage = {
        goto: jest.fn(),
        $$eval: jest.fn(),
        title: jest.fn().mockResolvedValue('Test Page'),
        close: jest.fn()
    };

    const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn()
    };

    beforeEach(() => {
        // Clean up test data before each test
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }

        const { firefox } = require('playwright');
        (firefox.launch as jest.Mock).mockResolvedValue(mockBrowser);

        detector = new XMLChangeDetector(testUrl, [], testDataDir);
    });

    afterEach(async () => {
        // Clean up test data after each test
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        it('should create instance with default parameters', () => {
            const det = new XMLChangeDetector(testUrl);
            expect(det).toBeInstanceOf(XMLChangeDetector);
        });

        it('should create instance with resource names', () => {
            const det = new XMLChangeDetector(testUrl, ['Deputados', 'Sessoes']);
            expect(det).toBeInstanceOf(XMLChangeDetector);
        });

        it('should create instance with custom data directory', () => {
            const det = new XMLChangeDetector(testUrl, [], './custom-data');
            expect(det).toBeInstanceOf(XMLChangeDetector);
        });

        it('should create data directory if it does not exist', () => {
            const customDir = './test-custom-data';
            new XMLChangeDetector(testUrl, [], customDir);
            expect(fs.existsSync(customDir)).toBe(true);
            // Cleanup
            fs.rmSync(customDir, { recursive: true, force: true });
        });
    });

    describe('Resource Discovery and Filtering', () => {
        it('should discover all resources when no filter is provided', async () => {
            // Mock resources with different URLs
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' },
                { href: '/Cidadania/Paginas/DASessoes.aspx', title: 'Recursos', text: 'Sessões', outerHTML: '<a href="/Cidadania/Paginas/DASessoes.aspx" title="Recursos">Sessões</a>' },
                { href: '/Cidadania/Paginas/DAIniciativas.aspx', title: 'Recursos', text: 'Iniciativas', outerHTML: '<a href="/Cidadania/Paginas/DAIniciativas.aspx" title="Recursos">Iniciativas</a>' }
            ];

            // Mock empty legislatures and XML files to avoid going deep
            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockResolvedValue([]); // Empty legislatures

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
            expect(mockPage.$$eval).toHaveBeenCalledWith('a[title="Recursos"]', expect.any(Function));
        });

        it('should filter resources based on provided names', async () => {
            const detectorWithFilter = new XMLChangeDetector(testUrl, ['Deputados']);
            
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' },
                { href: '/Cidadania/Paginas/DASessoes.aspx', title: 'Recursos', text: 'Sessões', outerHTML: '<a href="/Cidadania/Paginas/DASessoes.aspx" title="Recursos">Sessões</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockResolvedValue([]); // Empty legislatures

            const results = await detectorWithFilter.detectAllChanges();
            expect(results).toEqual([]);
            // Should call goto for base URL and filtered resource URL
            expect(mockPage.goto).toHaveBeenCalledWith(testUrl, { waitUntil: 'networkidle' });
        });

        it('should handle complete workflow with mocked data', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII">Pasta XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/deputados.xml', title: 'deputados.xml', text: 'deputados.xml', outerHTML: '<a href="/xml/deputados.xml" title="deputados.xml">deputados.xml</a>' }
            ];

            // Mock HTTP response for XML content
            const mockResponse = {
                text: jest.fn().mockResolvedValue('<xml>test content</xml>')
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockResolvedValueOnce(mockLegislatures) // Legislatures
                .mockResolvedValueOnce(mockXMLFiles); // XML files

            mockPage.goto
                .mockResolvedValue(mockResponse); // For XML download

            const results = await detector.detectAllChanges();
            expect(results).toHaveLength(1);
            expect(results[0].xmlFile.filename).toBe('deputados.xml');
            expect(results[0].changeResult.hasChanged).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle browser launch errors', async () => {
            const { firefox } = require('playwright');
            (firefox.launch as jest.Mock).mockRejectedValueOnce(new Error('Browser launch failed'));

            await expect(detector.detectAllChanges()).rejects.toThrow('Browser launch failed');
        });

        it('should handle page navigation errors', async () => {
            mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

            await expect(detector.detectAllChanges()).rejects.toThrow('Navigation failed');
        });

        it('should continue processing other resources when one fails', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockRejectedValueOnce(new Error('Legislature discovery failed')); // Legislatures fail

            // Should not throw, should continue and return empty results
            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });
    });

    describe('Data Persistence', () => {
        it('should create hash files for XML content', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII">Pasta XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/deputados.xml', title: 'deputados.xml', text: 'deputados.xml', outerHTML: '<a href="/xml/deputados.xml" title="deputados.xml">deputados.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue('<xml>test content</xml>')
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            const results = await detector.detectAllChanges();
            expect(results).toHaveLength(1);
            
            // Check if hash file was created
            const hashFiles = fs.readdirSync(testDataDir).filter(file => file.endsWith('_hash.txt'));
            expect(hashFiles).toHaveLength(1);
        });
    });
});
