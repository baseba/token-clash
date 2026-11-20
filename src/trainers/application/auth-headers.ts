const TOKEN_FORMAT = /^[A-Za-z0-9_-]{20,100}$/;

export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer (.+)$/.exec(header ?? '');
  return match && TOKEN_FORMAT.test(match[1]) ? match[1] : undefined;
}

export function basicCredentials(header: string | undefined): { name: string; password: string } | undefined {
  const match = /^Basic ([A-Za-z0-9+/=]{1,1000})$/.exec(header ?? '');
  if (!match) return undefined;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon <= 0) return undefined;
  return { name: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
}
