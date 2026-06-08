/**
 * Fluxo de "Login com Facebook para Empresas" usado para conectar contas
 * Instagram Business/Creator (substitui qualquer ideia de login com
 * usuário/senha — a Meta não permite e isso bane contas).
 *
 * Passo a passo real:
 *  1. Redirecionar o usuário para `buildAuthorizationUrl()`.
 *  2. A Meta redireciona de volta para META_REDIRECT_URI com `?code=...`.
 *  3. Trocar o `code` por um token de usuário em `exchangeCodeForToken()`.
 *  4. Listar as Páginas do usuário e suas contas IG vinculadas.
 */

const OAUTH_DIALOG_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const OAUTH_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];

export function buildAuthorizationUrl(state: string): string {
  const appId = requireEnv("META_APP_ID");
  const redirectUri = requireEnv("META_REDIRECT_URI");

  const url = new URL(OAUTH_DIALOG_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", REQUIRED_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const url = new URL(OAUTH_TOKEN_URL);
  url.searchParams.set("client_id", requireEnv("META_APP_ID"));
  url.searchParams.set("client_secret", requireEnv("META_APP_SECRET"));
  url.searchParams.set("redirect_uri", requireEnv("META_REDIRECT_URI"));
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json?.error?.message ?? "Falha ao trocar o código de autorização pelo token.");
  }

  return json as TokenResponse;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada.`);
  return value;
}
