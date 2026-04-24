import type { Photo } from '../components/PhotoGrid';

/**
 * Build a list of projects from `src/photos/projects/<slug>/` subfolders.
 *
 * Each subfolder is a project. The first image alphabetically is the cover,
 * unless a file named `cover.*` exists (it wins).
 *
 * Edit titles/descriptions in `meta` below — slug must match folder name.
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
  cover: Photo;
  photos: Photo[];
}

const projectModules = import.meta.glob<{ default: AssetMeta }>(
  '/src/photos/projects/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, import: 'default', query: { w: '1200', format: 'webp' } },
);

const meta: Record<string, { title?: string; description?: string }> = {
  // 'my-project': { title: 'My Project', description: 'What it was about.' },
};

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ' +
  'ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit ' +
  'in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

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
      description: m.description ?? LOREM,
      cover,
      photos,
    });
  }

  if (projects.length > 0) {
    return projects.sort((a, b) => a.title.localeCompare(b.title));
  }

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
      description: LOREM,
      cover: photos[0],
      photos,
    };
  });
}
