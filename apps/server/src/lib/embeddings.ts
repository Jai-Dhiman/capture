import type { ExportedHandler, ExecutionContext, Ai } from '@cloudflare/workers-types';

export interface Env {
  AI: Ai;
}

const handler: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    // grab `prompt` from POST body or URL query
    let prompt: string | null = null;
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      prompt = body.prompt;
    } else {
      prompt = new URL(request.url).searchParams.get('prompt');
    }

    if (!prompt) {
      return new Response('Missing prompt', { status: 400 });
    }

    // run the model
    const aiResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt });

    return new Response(JSON.stringify(aiResult), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

export default handler;
