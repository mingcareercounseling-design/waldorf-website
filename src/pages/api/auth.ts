export const prerender = false;
import type { APIRoute } from 'astro';

const CLIENT_ID = 'Ov23liDu3TN5aQanCs5F';
const REDIRECT_URI = 'https://kuanghe-waldorf-school.vercel.app/api/auth';

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const CLIENT_SECRET = import.meta.env.GITHUB_CLIENT_SECRET;

  if (!code) {
    const githubUrl = new URL('https://github.com/login/oauth/authorize');
    githubUrl.searchParams.set('client_id', CLIENT_ID);
    githubUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    githubUrl.searchParams.set('scope', 'repo,user');
    return redirect(githubUrl.toString(), 302);
  }

  try {
    const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI }),
    });
    const tokenData = await tokenResp.json() as { access_token?: string; error?: string; error_description?: string };

    if (tokenData.error || !tokenData.access_token) {
      return new Response(makePopupHtml('error', tokenData.error_description || tokenData.error || 'auth failed'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    return new Response(makePopupHtml('success', tokenData.access_token), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (e) {
    return new Response(makePopupHtml('error', 'fetch failed'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
};

function makePopupHtml(status: 'success' | 'error', payload: string) {
  const content = status === 'success'
    ? { token: payload, provider: 'github' }
    : payload;
  const msgStr = `authorization:github:${status}:${JSON.stringify(content)}`;
  const msgJson = JSON.stringify(msgStr);
  return `<!DOCTYPE html><html><body><script>
(function(){
  var msg = ${msgJson};
  function send(origin) { window.opener.postMessage(msg, origin || '*'); }
  window.addEventListener('message', function(e) { send(e.origin); }, false);
  window.opener.postMessage('authorizing:github', '*');
  setTimeout(function() { send('*'); }, 500);
})();
<\/script></body></html>`;
}
