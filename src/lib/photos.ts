import type { Photo } from '../components/PhotoGrid';

/**
 * Build a Photo manifest for a topic.
 *
 * Photos live under `src/photos/<topic>/`. For the "photos" topic, you can
 * organize images into place subfolders (`src/photos/photos/<place>/`) and
 * the place name becomes a filter pill on the page automatically.
 */

interface AssetMeta {
  src: string;
  width: number;
  height: number;
}

export interface PhotoWithPlace extends Photo {
  place?: string;
}

const photoModules = import.meta.glob<{ default: AssetMeta }>(
  '/src/photos/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, import: 'default', query: { w: '1200', format: 'webp' } },
);

export function getPhotos(topic: string, fallbackCount = 24): PhotoWithPlace[] {
  const prefix = `/src/photos/${topic}/`;
  const matches = Object.entries(photoModules)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, meta]) => {
      const rel = path.slice(prefix.length);
      const parts = rel.split('/');
      const place = parts.length > 1 ? parts[0] : undefined;
      const filename = parts[parts.length - 1] ?? rel;
      return {
        src: meta.src,
        alt: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        width: meta.width,
        height: meta.height,
        place,
      } satisfies PhotoWithPlace;
    })
    .sort((a, b) => a.alt.localeCompare(b.alt));

  if (matches.length > 0) return matches;

  const fakePlaces = ['Place 1', 'Place 2', 'Place 3', 'Place 4', 'Place 5'];
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
      place: fakePlaces[i % fakePlaces.length],
    } satisfies PhotoWithPlace;
  });
}

export function getPlaces(topic: string): string[] {
  const photos = getPhotos(topic);
  const places = new Set<string>();
  for (const p of photos) if (p.place) places.add(p.place);
  return Array.from(places).sort();
}
