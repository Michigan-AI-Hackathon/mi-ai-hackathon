// Only plain same-site paths: "//evil.com" and "/\evil.com" are treated as other sites by browsers.
export function safeNext(n: string | null | undefined): string | undefined {
  return n && /^\/(?![/\\])[\w\-./?=&%]*$/.test(n) ? n : undefined;
}
