import { XMLChangeDetector, XMLFileChangeResult } from '../src/change-detector';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Mock Playwright
jest.mock('playwright', () => ({
    firefox: {
        launch: jest.fn()
    }
}));

describe('XMLChangeDetector - Complete Test Suite', () => {
    let detector: XMLChangeDetector;
    const testUrl = 'https://www.parlamento.pt/Cidadania/paginas/dadosabertos.aspx';
    const testDataDir = './test-data';

    // Mock browser and page
    const mockPage = {
        goto: jest.fn(),
        $$eval: jest.fn(),
        title: jest.fn().mockResolvedValue('Dados abertos'),
        close: jest.fn(),
        screenshot: jest.fn()
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

        it('should handle empty resource names array', () => {
            const det = new XMLChangeDetector(testUrl, []);
            expect(det).toBeInstanceOf(XMLChangeDetector);
        });

        it('should handle multiple resource names', () => {
            const det = new XMLChangeDetector(testUrl, ['Deputados', 'Sessoes', 'Iniciativas']);
            expect(det).toBeInstanceOf(XMLChangeDetector);
        });
    });

    describe('Resource Discovery', () => {
        it('should discover all resources when no filter is provided', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' },
                { href: '/Cidadania/Paginas/DASessoes.aspx', title: 'Recursos', text: 'Sessões', outerHTML: '<a href="/Cidadania/Paginas/DASessoes.aspx" title="Recursos">Sessões</a>' },
                { href: '/Cidadania/Paginas/DAIniciativas.aspx', title: 'Recursos', text: 'Iniciativas', outerHTML: '<a href="/Cidadania/Paginas/DAIniciativas.aspx" title="Recursos">Iniciativas</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockResolvedValue([]); // Empty legislatures

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
            expect(mockPage.$$eval).toHaveBeenCalledWith('a[title="Recursos"]', expect.any(Function));
        });

        it('should filter resources based on provided names', async () => {
            const detectorWithFilter = new XMLChangeDetector(testUrl, ['Deputados'], testDataDir);
            
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' },
                { href: '/Cidadania/Paginas/DASessoes.aspx', title: 'Recursos', text: 'Sessões', outerHTML: '<a href="/Cidadania/Paginas/DASessoes.aspx" title="Recursos">Sessões</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockResolvedValue([]); // Empty legislatures

            const results = await detectorWithFilter.detectAllChanges();
            expect(results).toEqual([]);
            expect(mockPage.goto).toHaveBeenCalledWith(testUrl, { waitUntil: 'networkidle' });
        });

        it('should handle malformed URLs in resource discovery', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' },
                { href: 'invalid-url', title: 'Recursos', text: 'Invalid', outerHTML: '<a href="invalid-url" title="Recursos">Invalid</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle resources with no matching names', async () => {
            const detectorWithFilter = new XMLChangeDetector(testUrl, ['NonExistent'], testDataDir);
            
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValue([]);

            const results = await detectorWithFilter.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle resources with relative URLs', async () => {
            const mockResources = [
                { href: 'Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle resources with empty href', async () => {
            const mockResources = [
                { href: '', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="" title="Recursos">Deputados</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle resources with null href', async () => {
            const mockResources = [
                { href: null, title: 'Recursos', text: 'Deputados', outerHTML: '<a title="Recursos">Deputados</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle URL patterns that do not match DA*.aspx', async () => {
            const detectorWithFilter = new XMLChangeDetector(testUrl, ['Test'], testDataDir);
            
            const mockResources = [
                { href: '/Cidadania/Paginas/InvalidPattern.aspx', title: 'Recursos', text: 'Test', outerHTML: '<a href="/Cidadania/Paginas/InvalidPattern.aspx" title="Recursos">Test</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValue([]);

            const results = await detectorWithFilter.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle resources with empty URL path', async () => {
            const detectorWithFilter = new XMLChangeDetector(testUrl, ['Test'], testDataDir);
            
            const mockResources = [
                { href: '/', title: 'Recursos', text: 'Test', outerHTML: '<a href="/" title="Recursos">Test</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValue([]);

            const results = await detectorWithFilter.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle multiple matching and non-matching resources', async () => {
            const detectorWithFilter = new XMLChangeDetector(testUrl, ['Deputados', 'Sessoes'], testDataDir);
            
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' },
                { href: '/Cidadania/Paginas/DASessoes.aspx', title: 'Recursos', text: 'Sessões', outerHTML: '<a href="/Cidadania/Paginas/DASessoes.aspx" title="Recursos">Sessões</a>' },
                { href: '/Cidadania/Paginas/DAIniciativas.aspx', title: 'Recursos', text: 'Iniciativas', outerHTML: '<a href="/Cidadania/Paginas/DAIniciativas.aspx" title="Recursos">Iniciativas</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValue([]);

            const results = await detectorWithFilter.detectAllChanges();
            expect(results).toEqual([]);
        });
    });

    describe('Legislature Discovery', () => {
        it('should discover legislatures with proper title pattern', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' },
                { href: '/legislatures/XVI', text: 'XVI Legislatura', title: 'Pasta XVI Legislatura', outerHTML: '<a href="/legislatures/XVI" title="Pasta XVI Legislatura">XVI Legislatura</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockResolvedValueOnce(mockLegislatures) // Legislatures
                .mockResolvedValue([]); // Empty XML files

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
            expect(mockPage.goto).toHaveBeenCalledTimes(4); // Base URL + 1 resource + 2 legislatures
        });

        it('should handle legislatures with invalid URLs', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: 'invalid-url', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="invalid-url" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should filter legislatures that do not match title pattern', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' },
                { href: '/other/link', text: 'Other Link', title: 'Other Link', outerHTML: '<a href="/other/link" title="Other Link">Other Link</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle legislatures with relative URLs', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: 'relative/path/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="relative/path/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle legislatures with empty href', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle legislatures with null href', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: null, text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should use text content when title is not available', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'Pasta XVII Legislatura', title: '', outerHTML: '<a href="/legislatures/XVII" title="">Pasta XVII Legislatura</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle legislatures with mixed valid and invalid patterns', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' },
                { href: '/invalid/link', text: 'Invalid Pattern', title: 'Invalid Pattern', outerHTML: '<a href="/invalid/link" title="Invalid Pattern">Invalid Pattern</a>' },
                { href: '/legislatures/XVI', text: 'XVI Legislatura', title: 'Pasta XVI Legislatura', outerHTML: '<a href="/legislatures/XVI" title="Pasta XVI Legislatura">XVI Legislatura</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValue([]);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });
    });

    describe('XML File Discovery', () => {
        it('should discover XML files by href content', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/deputados.xml', title: 'deputados.xml', text: 'deputados.xml', outerHTML: '<a href="/xml/deputados.xml" title="deputados.xml">deputados.xml</a>' },
                { href: '/xml/sessoes.xml', title: 'sessoes.xml', text: 'sessoes.xml', outerHTML: '<a href="/xml/sessoes.xml" title="sessoes.xml">sessoes.xml</a>' }
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
            expect(results).toHaveLength(2);
            expect(results[0].xmlFile.filename).toBe('deputados.xml');
            expect(results[1].xmlFile.filename).toBe('sessoes.xml');
        });

        it('should discover XML files by title content', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/download/file1', title: 'data.xml', text: 'Download', outerHTML: '<a href="/download/file1" title="data.xml">Download</a>' }
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
            expect(results[0].xmlFile.filename).toBe('data.xml');
        });

        it('should handle XML files with relative URLs', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: 'relative/path/data.xml', title: 'data.xml', text: 'data.xml', outerHTML: '<a href="relative/path/data.xml" title="data.xml">data.xml</a>' }
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
            expect(results[0].xmlFile.url).toContain('relative/path/data.xml');
        });

        it('should handle XML files with empty href', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '', title: 'data.xml', text: 'data.xml', outerHTML: '<a href="" title="data.xml">data.xml</a>' }
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
            expect(results[0].xmlFile.filename).toBe('data.xml');
        });

        it('should handle XML files with null href', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: null, title: 'data.xml', text: 'data.xml', outerHTML: '<a title="data.xml">data.xml</a>' }
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
            expect(results[0].xmlFile.filename).toBe('data.xml');
        });

        it('should use fallback filename when all fields are empty', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '', title: '', text: '', outerHTML: '<a href="" title=""></a>' }
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
            expect(results[0].xmlFile.filename).toBe('unknown.xml');
        });

        it('should extract filename from URL path', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/path/to/document.xml', title: '', text: '', outerHTML: '<a href="/path/to/document.xml" title=""></a>' }
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
            expect(results[0].xmlFile.filename).toBe('document.xml');
        });

        it('should handle URLs with no path segments', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/', title: '', text: '', outerHTML: '<a href="/" title=""></a>' }
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
            expect(results[0].xmlFile.filename).toBe('unknown.xml');
        });
    });

    describe('Change Detection', () => {
        it('should detect changes in XML files', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
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
            expect(results[0].changeResult.hasChanged).toBe(true);
            expect(results[0].changeResult.currentHash).toBeDefined();
            expect(results[0].changeResult.previousHash).toBeUndefined();
        });

        it('should detect when content has not changed', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue('<xml>test content</xml>')
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            // First run
            const results1 = await detector.detectAllChanges();
            expect(results1[0].changeResult.hasChanged).toBe(true);

            // Reset mocks for second run
            jest.clearAllMocks();
            const { firefox } = require('playwright');
            (firefox.launch as jest.Mock).mockResolvedValue(mockBrowser);

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            // Second run
            const results2 = await detector.detectAllChanges();
            expect(results2[0].changeResult.hasChanged).toBe(false);
            expect(results2[0].changeResult.previousHash).toBeDefined();
        });

        it('should detect content changes', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            const mockResponse1 = {
                text: jest.fn().mockResolvedValue('<xml>first content</xml>')
            };

            const mockResponse2 = {
                text: jest.fn().mockResolvedValue('<xml>second content</xml>')
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse1);

            // First run
            const results1 = await detector.detectAllChanges();
            expect(results1[0].changeResult.hasChanged).toBe(true);

            // Reset mocks for second run
            jest.clearAllMocks();
            const { firefox } = require('playwright');
            (firefox.launch as jest.Mock).mockResolvedValue(mockBrowser);

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse2);

            // Second run with different content
            const results2 = await detector.detectAllChanges();
            expect(results2[0].changeResult.hasChanged).toBe(true);
            expect(results2[0].changeResult.currentHash).not.toBe(results1[0].changeResult.currentHash);
            expect(results2[0].changeResult.previousHash).toBe(results1[0].changeResult.currentHash);
        });

        it('should create and manage hash files', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
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
            
            // Check hash file content
            const hashContent = fs.readFileSync(path.join(testDataDir, hashFiles[0]), 'utf8');
            expect(hashContent).toBe(results[0].changeResult.currentHash);
        });

        it('should handle hash file corruption gracefully', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue('<xml>test content</xml>')
            };

            // Create corrupted hash file
            const identifier = crypto.createHash('sha256').update(mockXMLFiles[0].outerHTML).digest('hex').substring(0, 12);
            const hashFile = path.join(testDataDir, `${identifier}_hash.txt`);
            fs.writeFileSync(hashFile, 'corrupted_hash_content');

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            const results = await detector.detectAllChanges();
            expect(results).toHaveLength(1);
            expect(results[0].changeResult.hasChanged).toBe(true);
            expect(results[0].changeResult.previousHash).toBe('corrupted_hash_content');
        });

        it('should handle hash file with whitespace', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue('<xml>test content</xml>')
            };

            // Create hash file with whitespace
            const currentHash = crypto.createHash('sha256').update('<xml>test content</xml>').digest('hex');
            const identifier = crypto.createHash('sha256').update(mockXMLFiles[0].outerHTML).digest('hex').substring(0, 12);
            const hashFile = path.join(testDataDir, `${identifier}_hash.txt`);
            fs.writeFileSync(hashFile, `  ${currentHash}  \n`);

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            const results = await detector.detectAllChanges();
            expect(results).toHaveLength(1);
            expect(results[0].changeResult.hasChanged).toBe(false);
            expect(results[0].changeResult.previousHash).toBe(currentHash);
        });

        it('should handle empty XML content', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue('')
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle null XML response', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(null);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle XML response with null text method', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue(null)
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]);
        });

        it('should handle very large XML content', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            const largeContent = '<xml>' + 'a'.repeat(1000000) + '</xml>';
            const mockResponse = {
                text: jest.fn().mockResolvedValue(largeContent)
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            const results = await detector.detectAllChanges();
            expect(results).toHaveLength(1);
            expect(results[0].changeResult.hasChanged).toBe(true);
            expect(results[0].changeResult.currentHash).toBeDefined();
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

        it('should handle XML download failures', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(null); // Failed XML download

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]); // Should handle error gracefully
        });

        it('should handle empty XML response', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test.xml', title: 'test.xml', text: 'test.xml', outerHTML: '<a href="/xml/test.xml" title="test.xml">test.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue('')
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto.mockResolvedValue(mockResponse);

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]); // Should handle empty content gracefully
        });

        it('should continue processing when individual resources fail', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' },
                { href: '/Cidadania/Paginas/DASessoes.aspx', title: 'Recursos', text: 'Sessões', outerHTML: '<a href="/Cidadania/Paginas/DASessoes.aspx" title="Recursos">Sessões</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockRejectedValueOnce(new Error('First resource failed')) // First resource fails
                .mockResolvedValueOnce([]); // Second resource succeeds with empty legislatures

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]); // Should continue processing despite first resource failure
        });

        it('should continue processing when individual legislatures fail', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' },
                { href: '/legislatures/XVI', text: 'XVI Legislatura', title: 'Pasta XVI Legislatura', outerHTML: '<a href="/legislatures/XVI" title="Pasta XVI Legislatura">XVI Legislatura</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockResolvedValueOnce(mockLegislatures) // Legislatures
                .mockRejectedValueOnce(new Error('First legislature failed')) // First legislature fails
                .mockResolvedValueOnce([]); // Second legislature succeeds with empty XML files

            const results = await detector.detectAllChanges();
            expect(results).toEqual([]); // Should continue processing despite first legislature failure
        });

        it('should continue processing when individual XML files fail', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/test1.xml', title: 'test1.xml', text: 'test1.xml', outerHTML: '<a href="/xml/test1.xml" title="test1.xml">test1.xml</a>' },
                { href: '/xml/test2.xml', title: 'test2.xml', text: 'test2.xml', outerHTML: '<a href="/xml/test2.xml" title="test2.xml">test2.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue('<xml>test content</xml>')
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce(mockLegislatures)
                .mockResolvedValueOnce(mockXMLFiles);

            mockPage.goto
                .mockResolvedValueOnce(mockResponse) // Navigation to resource
                .mockResolvedValueOnce(mockResponse) // Navigation to legislature
                .mockResolvedValueOnce(null) // First XML file fails
                .mockResolvedValueOnce(mockResponse); // Second XML file succeeds

            const results = await detector.detectAllChanges();
            expect(results).toHaveLength(1); // Should have one successful result
            expect(results[0].xmlFile.filename).toBe('test1.xml'); // The first one that succeeded
        });
    });

    describe('Browser Management', () => {
        it('should close browser even if errors occur', async () => {
            mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

            await expect(detector.detectAllChanges()).rejects.toThrow('Navigation failed');
            expect(mockBrowser.close).toHaveBeenCalled();
        });

        it('should check browser management during discovery', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DAInformacaoBase.aspx', title: 'Recursos', text: 'Recursos', outerHTML: '<a href="/Cidadania/Paginas/DAInformacaoBase.aspx" title="Recursos">Recursos</a>' }
            ];

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources)
                .mockResolvedValueOnce([]); // Empty legislatures

            const results = await detector.detectAllChanges();
            expect(mockBrowser.close).toHaveBeenCalled();
        });
    });

    describe('Integration Tests', () => {
        it('should handle complete workflow with multiple resources and legislatures', async () => {
            const mockResources = [
                { href: '/Cidadania/Paginas/DADeputados.aspx', title: 'Recursos', text: 'Deputados', outerHTML: '<a href="/Cidadania/Paginas/DADeputados.aspx" title="Recursos">Deputados</a>' },
                { href: '/Cidadania/Paginas/DASessoes.aspx', title: 'Recursos', text: 'Sessões', outerHTML: '<a href="/Cidadania/Paginas/DASessoes.aspx" title="Recursos">Sessões</a>' }
            ];

            const mockLegislatures = [
                { href: '/legislatures/XVII', text: 'XVII Legislatura', title: 'Pasta XVII Legislatura', outerHTML: '<a href="/legislatures/XVII" title="Pasta XVII Legislatura">XVII Legislatura</a>' },
                { href: '/legislatures/XVI', text: 'XVI Legislatura', title: 'Pasta XVI Legislatura', outerHTML: '<a href="/legislatures/XVI" title="Pasta XVI Legislatura">XVI Legislatura</a>' }
            ];

            const mockXMLFiles = [
                { href: '/xml/deputados.xml', title: 'deputados.xml', text: 'deputados.xml', outerHTML: '<a href="/xml/deputados.xml" title="deputados.xml">deputados.xml</a>' }
            ];

            const mockResponse = {
                text: jest.fn().mockResolvedValue('<xml>test content</xml>')
            };

            mockPage.$$eval
                .mockResolvedValueOnce(mockResources) // Resources
                .mockResolvedValueOnce(mockLegislatures) // Legislatures for first resource
                .mockResolvedValueOnce(mockXMLFiles) // XML files for first legislature
                .mockResolvedValueOnce(mockXMLFiles) // XML files for second legislature
                .mockResolvedValueOnce(mockLegislatures) // Legislatures for second resource
                .mockResolvedValueOnce(mockXMLFiles) // XML files for first legislature of second resource
                .mockResolvedValueOnce(mockXMLFiles); // XML files for second legislature of second resource

            mockPage.goto.mockResolvedValue(mockResponse);

            const results = await detector.detectAllChanges();
            expect(results).toHaveLength(4); // 2 resources * 2 legislatures * 1 XML file each
            expect(results.every(r => r.xmlFile.filename === 'deputados.xml')).toBe(true);
        });
    });
});
