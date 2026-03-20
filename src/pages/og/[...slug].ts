import type { APIContext } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { html } from 'satori-html';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fontData = readFileSync(join(process.cwd(), 'src/fonts/SourceSerif4.ttf'));

export async function getStaticPaths() {
  const posts = (await getCollection('blog')).filter(
    (post) => !post.data.draft
  );

  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

export async function GET({ props }: APIContext) {
  const { post } = props as { post: CollectionEntry<'blog'> };

  const formattedDate = new Date(post.data.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const tags = post.data.tags.map((t: string) => `#${t}`).join('  ');
  const safeTitle = post.data.title.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const markup = html`
    <div
      style="display: flex; flex-direction: column; justify-content: space-between; width: 1200px; height: 630px; background: #f6f4f0; padding: 60px;"
    >
      <div style="display: flex; flex-direction: column;">
        <div style="font-size: 24px; color: #666; margin-bottom: 16px;">
          ${formattedDate}
        </div>
        <div
          style="font-size: 52px; font-weight: 700; color: #1a1a1a; line-height: 1.2; max-width: 1000px;"
        >
          ${safeTitle}
        </div>
      </div>
      <div
        style="display: flex; justify-content: space-between; align-items: flex-end;"
      >
        <div style="font-size: 20px; color: #888;">${tags}</div>
        <div style="font-size: 20px; color: #aaa;">ukint-vs.github.io</div>
      </div>
    </div>
  `;

  try {
    const svg = await satori(markup, {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Source Serif 4',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    });

    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
      },
    });
  } catch (err) {
    console.error('OG image generation failed:', err);
    return new Response('OG image generation failed', { status: 500 });
  }
}
