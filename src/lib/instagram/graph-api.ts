/**
 * Cliente para a Instagram Graph API (Meta).
 *
 * Pré-requisitos reais para isso funcionar em produção:
 *  - Um App da Meta em developers.facebook.com com o produto
 *    "Instagram Graph API" / "Facebook Login for Business" habilitado.
 *  - A conta do Instagram deve ser do tipo Business ou Creator e estar
 *    vinculada a uma Página do Facebook.
 *  - O usuário autoriza o app via OAuth (fluxo em `oauth.ts`), gerando um
 *    token de usuário que é trocado por um token de longa duração.
 *
 * Documentação oficial:
 *  https://developers.facebook.com/docs/instagram-platform/instagram-graph-api
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class GraphApiError extends Error {
  constructor(message: string, public status: number, public response: unknown) {
    super(message);
    this.name = "GraphApiError";
  }
}

async function graphRequest<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  init?: RequestInit
): Promise<T> {
  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), init);
  const json = await res.json();

  if (!res.ok || json.error) {
    throw new GraphApiError(
      json?.error?.message ?? `Falha na chamada à Graph API (${path})`,
      res.status,
      json
    );
  }

  return json as T;
}

// ---------- Páginas e contas Instagram vinculadas ----------

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

/** Lista as Páginas do Facebook que o usuário administra, com a conta IG vinculada (se houver). */
export async function listManagedPages(userAccessToken: string) {
  const data = await graphRequest<{ data: FacebookPage[] }>("/me/accounts", {
    fields: "id,name,access_token,instagram_business_account",
    access_token: userAccessToken,
  });
  return data.data;
}

export interface InstagramBusinessAccount {
  id: string;
  username: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

/** Busca os detalhes da conta Instagram Business/Creator vinculada a uma Página. */
export async function getInstagramAccount(igUserId: string, pageAccessToken: string) {
  return graphRequest<InstagramBusinessAccount>(`/${igUserId}`, {
    fields: "id,username,profile_picture_url,followers_count,follows_count,media_count",
    access_token: pageAccessToken,
  });
}

// ---------- Tokens de longa duração ----------

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // segundos (~60 dias)
}

/** Troca um token de curta duração por um de longa duração (~60 dias). */
export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const appId = requireEnv("META_APP_ID");
  const appSecret = requireEnv("META_APP_SECRET");

  return graphRequest<LongLivedTokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
}

/** Renova um token de longa duração antes que expire (deve ser chamado periodicamente). */
export async function refreshLongLivedToken(currentToken: string) {
  return graphRequest<LongLivedTokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    fb_exchange_token: currentToken,
  });
}

// ---------- Insights da conta ----------

export interface AccountInsights {
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  reach?: number;
  impressions?: number;
  profileViews?: number;
}

export async function fetchAccountInsights(
  igUserId: string,
  accessToken: string
): Promise<AccountInsights> {
  const account = await getInstagramAccount(igUserId, accessToken);

  let reach: number | undefined;
  let impressions: number | undefined;
  let profileViews: number | undefined;

  try {
    const insights = await graphRequest<{
      data: { name: string; values: { value: number }[] }[];
    }>(`/${igUserId}/insights`, {
      metric: "reach,impressions,profile_views",
      period: "day",
      access_token: accessToken,
    });

    for (const metric of insights.data) {
      const latest = metric.values?.[metric.values.length - 1]?.value;
      if (metric.name === "reach") reach = latest;
      if (metric.name === "impressions") impressions = latest;
      if (metric.name === "profile_views") profileViews = latest;
    }
  } catch {
    // Insights podem não estar disponíveis para todas as contas/períodos; ignora silenciosamente.
  }

  return {
    followersCount: account.followers_count,
    followsCount: account.follows_count,
    mediaCount: account.media_count,
    reach,
    impressions,
    profileViews,
  };
}

// ---------- Publicação de conteúdo (Content Publishing API) ----------

export type GraphMediaType = "FEED" | "REELS" | "STORIES" | "CAROUSEL";

interface CreateContainerParams {
  igUserId: string;
  accessToken: string;
  mediaUrl: string;
  mediaType: GraphMediaType;
  caption?: string;
  isVideo: boolean;
}

interface MediaContainerResponse {
  id: string;
}

/**
 * Cria um "container" de mídia (passo 1 da publicação). A Graph API exige que
 * a mídia esteja acessível publicamente via URL (ex: armazenada em S3/Cloud Storage).
 */
export async function createMediaContainer({
  igUserId,
  accessToken,
  mediaUrl,
  mediaType,
  caption,
  isVideo,
}: CreateContainerParams) {
  const params: Record<string, string | number | undefined> = {
    access_token: accessToken,
    caption,
  };

  if (isVideo) {
    params.video_url = mediaUrl;
    if (mediaType === "REELS") params.media_type = "REELS";
    if (mediaType === "STORIES") params.media_type = "STORIES";
  } else {
    params.image_url = mediaUrl;
    if (mediaType === "STORIES") params.media_type = "STORIES";
  }

  return graphRequest<MediaContainerResponse>(`/${igUserId}/media`, params, { method: "POST" });
}

/** Verifica se um container de mídia terminou de processar e está pronto para publicar. */
export async function getContainerStatus(containerId: string, accessToken: string) {
  return graphRequest<{ status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED" }>(
    `/${containerId}`,
    { fields: "status_code", access_token: accessToken }
  );
}

/** Publica um container de mídia já processado (passo 2 da publicação). */
export async function publishMediaContainer(
  igUserId: string,
  containerId: string,
  accessToken: string
) {
  return graphRequest<{ id: string }>(
    `/${igUserId}/media_publish`,
    { creation_id: containerId, access_token: accessToken },
    { method: "POST" }
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada.`);
  return value;
}
