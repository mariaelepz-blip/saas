import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { buildAuthorizationUrl } from "@/lib/instagram/oauth";

/**
 * Inicia o fluxo de conexão de uma conta do Instagram via OAuth da Meta.
 * Não existe "login com usuário e senha" — o dono da conta autoriza o
 * acesso pelo diálogo oficial do Facebook/Instagram.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));
  }

  // `state` carrega o id do usuário (assinado via cookie httpOnly) para
  // associarmos a conta conectada a ele no callback, e protege contra CSRF.
  const state = randomUUID();

  const response = NextResponse.redirect(buildAuthorizationUrl(state));
  response.cookies.set("ig_oauth_state", `${state}:${session.user.id}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}
