/**
 * serverHeader.ts
 *
 * Strips fingerprinting response headers that leak the server stack:
 *   - `X-Powered-By` (Express default)
 *   - `Server` (Node http default is empty, but some deploys add it)
 *
 * ZAP's "Server Leaks Version Information" and "X-Powered-By Header
 * Information Leak" alerts are both neutralised here. Helmet also
 * removes X-Powered-By, but this middleware is defense-in-depth in
 * case a later handler re-adds either header.
 */

import { Request, Response, NextFunction } from 'express';

export function stripServerHeaders(_req: Request, res: Response, next: NextFunction): void {
  // removeHeader is a no-op if the header wasn't set. `app.disable('x-powered-by')`
  // already suppresses Express's default; this is belt-and-braces in case any
  // downstream handler re-adds it. Node's http module does not set `Server`
  // by default, but we drop it here too for the same reason.
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Hook writeHead to strip again right before the response is serialised,
  // so any late additions by downstream middleware are neutralised.
  const origWriteHead = res.writeHead.bind(res) as typeof res.writeHead;
  res.writeHead = function patchedWriteHead(
    this: Response,
    ...args: Parameters<typeof res.writeHead>
  ): Response {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    return origWriteHead(...args);
  } as typeof res.writeHead;

  next();
}
