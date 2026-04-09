export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
        responseLimit: false,
        externalResolver: true,
    },
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
        console.error('DASHSCOPE_API_KEY not found');
        return res.status(500).json({ error: 'API Key not configured' });
    }

    const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

    try {
        console.log('[API] Starting request to DashScope...');
        console.log('[API] Model:', req.body?.model);
        console.log('[API] Messages count:', req.body?.messages?.length);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(req.body)
        });

        console.log('[API] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API] Error:', response.status, errorText);
            return res.status(response.status).json({ 
                error: `DashScope API error: ${errorText}` 
            });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let chunkCount = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('[API] Stream completed, total chunks:', chunkCount);
                break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            chunkCount++;
            res.write(chunk);
        }

        res.end();
    } catch (error) {
        console.error('[API] Proxy error:', error.message);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
}
