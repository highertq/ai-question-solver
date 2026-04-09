export const config = {
    api: {
        bodyParser: true,
        responseLimit: false,
    },
    maxDuration: 60,
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const API_KEY = process.env.DASHSCOPE_API_KEY;
    
    if (!API_KEY) {
        console.error('DASHSCOPE_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'API Key not configured' });
    }

    const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(req.body),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DashScope API error:', response.status, errorText);
            return res.status(response.status).json({ error: errorText });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
        }

        res.end();
    } catch (error) {
        console.error('Proxy error:', error);
        if (error.name === 'AbortError') {
            return res.status(504).json({ error: 'Request timeout' });
        }
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
}
