import type { Photo } from '../components/PhotoGrid';

/**
 * Build a list of projects from `src/photos/projects/<slug>/` subfolders.
 *
 * Each subfolder is a project. The first image alphabetically is the cover,
 * unless a file named `cover.*` exists (it wins).
 *
 * Edit titles/descriptions/dates in `meta` below — slug must match folder name.
 * Without any folders, falls back to placeholder projects so the page renders.
 */

interface AssetMeta {
  src: string;
  width: number;
  height: number;
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  date: string;
  cover: Photo;
  photos: Photo[];
}

const projectModules = import.meta.glob<{ default: AssetMeta }>(
  '/src/photos/projects/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, import: 'default', query: { w: '1200', format: 'webp' } },
);

const meta: Record<string, { title?: string; description?: string; date?: string }> = {
  // 'my-project': { title: 'My Project', description: 'What it was about.', date: 'Apr 2026' },
};

const PLACEHOLDER_SUMMARY =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

const PLACEHOLDER_DATE = 'Apr 2026';

function prettifySlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function toPhoto(path: string, asset: AssetMeta): Photo {
  const filename = path.split('/').pop() ?? path;
  return {
    src: asset.src,
    alt: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    width: asset.width,
    height: asset.height,
  };
}

export function getProjects(): Project[] {
  const prefix = '/src/photos/projects/';
  const bySlug = new Map<string, { path: string; asset: AssetMeta }[]>();

  for (const [path, asset] of Object.entries(projectModules)) {
    if (!path.startsWith(prefix)) continue;
    const rel = path.slice(prefix.length);
    const parts = rel.split('/');
    if (parts.length < 2) continue;
    const slug = parts[0];
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug)!.push({ path, asset });
  }

  const projects: Project[] = [];
  for (const [slug, items] of bySlug) {
    items.sort((a, b) => a.path.localeCompare(b.path));
    const coverItem =
      items.find((it) => /\/cover\.[^/]+$/i.test(it.path)) ?? items[0];
    const cover = toPhoto(coverItem.path, coverItem.asset);
    const photos = items.map((it) => toPhoto(it.path, it.asset));
    const m = meta[slug] ?? {};
    projects.push({
      slug,
      title: m.title ?? prettifySlug(slug),
      description: m.description ?? PLACEHOLDER_SUMMARY,
      date: m.date ?? PLACEHOLDER_DATE,
      cover,
      photos,
    });
  }

  if (projects.length > 0) {
    return projects.sort((a, b) => a.title.localeCompare(b.title));
  }

  const months = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026'];
  return Array.from({ length: 4 }, (_, i) => {
    const slug = `project-${i + 1}`;
    const photos: Photo[] = Array.from({ length: 9 }, (_, j) => {
      const seed = `${slug}-${j + 1}`;
      const portrait = j % 3 === 0;
      const w = portrait ? 600 : 800;
      const h = portrait ? 800 : 600;
      return {
        src: `https://picsum.photos/seed/${seed}/${w}/${h}`,
        alt: `${slug} photo ${j + 1}`,
        width: w,
        height: h,
      };
    });
    return {
      slug,
      title: `Project ${i + 1}`,
      description: PLACEHOLDER_SUMMARY,
      date: months[i] ?? PLACEHOLDER_DATE,
      cover: photos[0],
      photos,
    };
  });
}
