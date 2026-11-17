import { handleApi } from './api.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const rest = url.pathname.slice(4).replace(/^\/+/, '');
      let segments = [];
      if (rest) {
        try {
          segments = rest.split('/').map(decodeURIComponent);
        } catch {
          segments = rest.split('/');
        }
      }
      return handleApi(request, env, segments);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
};
