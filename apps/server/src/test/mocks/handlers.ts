import { http, HttpResponse } from 'msw';

// Simple hash function for deterministic mock responses
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export const handlers = [
  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
    });
  }),

  // Mock Voyage AI API
  http.post('https://api.voyageai.com/v1/embeddings', async ({ request }) => {
    const body = await request.json() as any;
    const inputText = typeof body.input === 'string' ? body.input : JSON.stringify(body.input);
    
    // Generate deterministic embeddings based on input hash for consistent cache testing
    const hash = simpleHash(inputText);
    const seed = hash % 1000000;
    
    return HttpResponse.json({
      data: [
        {
          embedding: new Array(1024).fill(0).map((_, i) => {
            // Deterministic random based on seed and index
            const pseudoRandom = Math.sin((seed + i) * 12345) * 10000;
            return (pseudoRandom - Math.floor(pseudoRandom)) * 2 - 1;
          }),
          index: 0,
        },
      ],
      model: body.model || 'voyage-3.5-lite', // Use text model for text embeddings
      usage: {
        total_tokens: inputText.length,
      },
    });
  }),

  // Mock Voyage AI Multimodal API
  http.post('https://api.voyageai.com/v1/multimodalembeddings', async ({ request }) => {
    const body = await request.json() as any;
    const inputString = JSON.stringify(body.input);
    
    // Generate deterministic embeddings based on input hash for consistent cache testing
    const hash = simpleHash(inputString);
    const seed = hash % 1000000;
    
    return HttpResponse.json({
      data: [
        {
          embedding: new Array(1024).fill(0).map((_, i) => {
            // Deterministic random based on seed and index
            const pseudoRandom = Math.sin((seed + i) * 12345) * 10000;
            return (pseudoRandom - Math.floor(pseudoRandom)) * 2 - 1;
          }),
          index: 0,
        },
      ],
      model: body.model || 'voyage-multimodal-3', // Use multimodal model for multimodal content
      usage: {
        total_tokens: 100,
        image_pixels: body.input[0]?.content?.some((c: any) => c.type === 'image') ? 50000 : undefined,
      },
    });
  }),

  // Mock Qdrant API
  http.get('*/collections/*', () => {
    return HttpResponse.json({
      result: {
        config: {
          params: {
            vectors: {
              size: 1024,
              distance: 'Cosine',
            },
          },
        },
        points_count: 0,
      },
    });
  }),

  http.put('*/collections/*', () => {
    return HttpResponse.json({
      result: true,
      status: 'ok',
    });
  }),
];
