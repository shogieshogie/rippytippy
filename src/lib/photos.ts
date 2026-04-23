import type { Photo } from '../components/PhotoGrid';

/**
 * Build a Photo manifest for a topic.
 *
 * Photos live under `src/photos/<topic>/` so Vite can hash + optimize them.
 * To add a photo, drop the file in that folder and it appears automatically.
 *
 * Until you add real images, `getPhotos` falls back to colorful placeholders
 * so the grid renders during development.
 */

interface AssetMeta {
  src: string;
  width: number;
  height: number;
}

const photoModules = import.meta.glob<{ default: AssetMeta }>(
  '/src/photos/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, import: 'default', query: { w: '1200', format: 'webp' } },
);

export function getPhotos(topic: string, fallbackCount = 24): Photo[] {
  const prefix = `/src/photos/${topic}/`;
  const matches = Object.entries(photoModules)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, meta]) => {
      const filename = path.split('/').pop() ?? path;
      return {
        src: meta.src,
        alt: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        width: meta.width,
        height: meta.height,
      } satisfies Photo;
    })
    .sort((a, b) => a.alt.localeCompare(b.alt));

  if (matches.length > 0) return matches;

  return Array.from({ length: fallbackCount }, (_, i) => {
    const seed = `${topic}-${i + 1}`;
    const portrait = i % 3 === 0;
    const w = portrait ? 600 : 800;
    const h = portrait ? 800 : 600;
    return {
      src: `https://picsum.photos/seed/${seed}/${w}/${h}`,
      alt: `${topic} placeholder ${i + 1}`,
      width: w,
      height: h,
    } satisfies Photo;
  });
}
