export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const target = "https://drive-file-manager-9k9q.onrender.com" + url.pathname + url.search;
      const init: RequestInit = {
        method: request.method,
        headers: request.headers,
        body: (request.method === "GET" || request.method === "HEAD") ? undefined : request.body,
      };
      return fetch(target, init);
    }
    return env.ASSETS.fetch(request);
  }
};
