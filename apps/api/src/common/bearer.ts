/** Token de una cabecera `Authorization: Bearer <token>` (o `undefined`). */
export function bearerToken(authorization: string | undefined): string | undefined {
  const [scheme, token] = (authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}
