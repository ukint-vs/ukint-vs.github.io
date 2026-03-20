import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  return context.redirect('/rss.xml', 301);
}
