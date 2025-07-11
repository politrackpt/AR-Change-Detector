import { XMLChangeDetector } from './change-detector';

// Run every 5 minutes
(async () => {
    console.log('Running change detection...');
    const detector = new XMLChangeDetector(
        "https://www.parlamento.pt/Cidadania/Paginas/DAIniciativas.aspx?t=57465a4a5353424d5a576470633278686448567959513d3d&Path=y%2ftQ6TCTFve9MRes1iKK%2buTB6TunZPTlZnwhr7HZ5lE3rZkrQVOtKdda0ZlGqNp42eXXE3M3nW1ye4Lq4dsVJIeGR5LR%2f3XIssV6OIULrFOLf0pw1vOTl3xmkG8CZReRbsdo41ukaRCjavLf5CDBS35L5zoS%2fSjb6IkGmhIAfBVRtagMz1kKQ6o5bqyHclWwVRL3U7oWe7gV4Dt8tu3CqtL2sjggTsMfjQLa4RpbVynAgzueC1y4FOkvBK4rqAaW4MszqL6YidLMdbVJk7XJoywwIpZNzEW%2bF4rOLxZK6OHQM9Y%2fwQJNZYk%2b0ZRGqYeaG%2fd%2fS9wnTiAeVVBg6wFV%2bA%3d%3d"
    );
    
    try {
        const result = await detector.detectChanges('a[title*=".xml"]');
        
        if (result.hasChanged) {
            console.log('📧 Sending notification...');
            // Add your notification logic here (email, webhook, etc.)
        }
        else {
            console.log('No changes detected.');
        }
    } catch (error) {
        console.error('Monitoring error:', error);
    }
})(); // 5 minutes