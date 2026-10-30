import { UnauthorizedException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";

export type GoogleIdentity = {
  sub: string;
  email?: string;
  name?: string;
};

export type FacebookIdentity = {
  id: string;
  name?: string;
};

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleIdentity> {
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new UnauthorizedException("Google sign-in is not valid");
    const email = payload.email_verified === true ? payload.email?.trim().toLowerCase() : undefined;
    const name = payload.name?.trim();
    return {
      sub: payload.sub,
      email: email || undefined,
      name: name || undefined,
    };
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error;
    throw new UnauthorizedException("Google sign-in is not valid");
  }
}

export async function verifyFacebookAccessToken(accessToken: string, appId: string, appSecret: string): Promise<FacebookIdentity> {
  const appAccess = `${appId}|${appSecret}`;
  const debugUrl = new URL("https://graph.facebook.com/v21.0/debug_token");
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", appAccess);
  const debugResponse = await fetch(debugUrl);
  if (!debugResponse.ok) throw new UnauthorizedException("Facebook sign-in is not valid");
  const debug = (await debugResponse.json()) as { data?: { is_valid?: boolean; app_id?: string; user_id?: string } };
  const userId = debug.data?.user_id;
  if (!debug.data?.is_valid || debug.data.app_id !== appId || !userId) {
    throw new UnauthorizedException("Facebook sign-in is not valid");
  }

  const meUrl = new URL("https://graph.facebook.com/v21.0/me");
  meUrl.searchParams.set("fields", "id,name,email");
  meUrl.searchParams.set("access_token", accessToken);
  const meResponse = await fetch(meUrl);
  if (!meResponse.ok) throw new UnauthorizedException("Facebook sign-in is not valid");
  const me = (await meResponse.json()) as { id?: string; name?: string };
  if (!me.id || me.id !== userId) throw new UnauthorizedException("Facebook sign-in is not valid");
  const name = me.name?.trim();
  return { id: me.id, name: name || undefined };
}
