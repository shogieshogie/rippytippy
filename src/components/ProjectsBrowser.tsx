import { useEffect, useMemo, useState } from 'react';
import PhotoGrid from './PhotoGrid';
import type { Project } from '../lib/projects';

interface Props {
  projects: Project[];
}

export default function ProjectsBrowser({ projects }: Props) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('project');
    if (s && projects.some((p) => p.slug === s)) {
      setActiveSlug(s);
      setAnimKey((k) => k + 1);
    }
  }, [projects]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeSlug) url.searchParams.set('project', activeSlug);
    else url.searchParams.delete('project');
    window.history.replaceState({}, '', url.toString());
  }, [activeSlug]);

  const active = useMemo(
    () => projects.find((p) => p.slug === activeSlug) ?? null,
    [projects, activeSlug],
  );

  const open = (slug: string) => {
    setActiveSlug(slug);
    setAnimKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const close = () => setActiveSlug(null);

  return (
    <div className="projects-browser">
      <div className="project-pills">
        <button
          type="button"
          className={`pill${activeSlug === null ? ' active' : ''}`}
          onClick={close}
        >
          All
        </button>
        {projects.map((p) => (
          <span key={p.slug} className="pill-group">
            <span className="sep">|</span>
            <button
              type="button"
              className={`pill${activeSlug === p.slug ? ' active' : ''}`}
              onClick={() => (activeSlug === p.slug ? close() : open(p.slug))}
            >
              {p.title}
            </button>
          </span>
        ))}
      </div>

      {active === null ? (
        <div className="cover-grid">
          {projects.map((p) => (
            <button
              type="button"
              key={p.slug}
              className="cover-card"
              onClick={() => open(p.slug)}
              aria-label={`Open ${p.title}`}
            >
              <div
                className="cover-img"
                style={{ aspectRatio: `${p.cover.width} / ${p.cover.height}` }}
              >
                <img
                  src={p.cover.src}
                  alt={p.cover.alt}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="cover-meta">
                <h2>{p.title}</h2>
                <p>{p.description.slice(0, 90)}…</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="project-detail" key={animKey}>
          <div className="project-photos">
            <div className="deal-grid">
              {active.photos.map((photo, i) => {
                const seed = (i * 9301 + 49297) % 233280;
                const rand = seed / 233280;
                const fromX = (rand - 0.5) * 80;
                const fromRot = (rand - 0.5) * 14;
                return (
                  <div
                    key={photo.src}
                    className="deal-card"
                    style={
                      {
                        aspectRatio: `${photo.width} / ${photo.height}`,
                        animationDelay: `${i * 55}ms`,
                        ['--from-x' as string]: `${fromX}px`,
                        ['--from-rot' as string]: `${fromRot}deg`,
                      } as React.CSSProperties
                    }
                  >
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      loading={i < 4 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  </div>
                );
              })}
            </div>

            <details className="full-grid">
              <summary>View all in lightbox</summary>
              <PhotoGrid photos={active.photos} />
            </details>
          </div>

          <aside className="project-info">
            <button type="button" className="back" onClick={close}>
              ← All projects
            </button>
            <h2>{active.title}</h2>
            <p>{active.description}</p>
            <p>{active.description}</p>
            <p className="meta">{active.photos.length} photos</p>
          </aside>
        </div>
      )}

      <style>{`
        .projects-browser {
          padding: 0 1.5rem;
        }
        .project-pills {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.4rem;
          margin: -0.5rem 0 1.75rem;
          color: var(--muted, #a1a1aa);
          font-size: 1.35rem;
        }
        .pill {
          background: transparent;
          border: 0;
          color: inherit;
          font: inherit;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          transition: color 150ms ease;
        }
        .pill:hover { color: var(--fg, #fff); }
        .pill.active { color: var(--fg, #fff); font-weight: 700; }
        .sep { color: rgba(255, 255, 255, 0.25); }

        .cover-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.25rem;
        }
        .cover-card {
          background: transparent;
          border: 0;
          padding: 0;
          text-align: left;
          color: inherit;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: transform 200ms ease;
        }
        .cover-card:hover { transform: translateY(-3px); }
        .cover-img {
          overflow: hidden;
          border-radius: 8px;
          background: #1a1a1d;
        }
        .cover-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cover-meta h2 {
          margin: 0 0 0.25rem;
          font-size: 1.1rem;
        }
        .cover-meta p {
          margin: 0;
          color: var(--muted, #a1a1aa);
          font-size: 0.9rem;
        }

        .project-detail {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 2rem;
          align-items: start;
        }
        .project-photos { min-width: 0; }
        .deal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.75rem;
          perspective: 1200px;
        }
        .deal-card {
          overflow: hidden;
          border-radius: 8px;
          background: #1a1a1d;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
          transform-origin: 50% -40px;
          opacity: 0;
          animation: deal 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .deal-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        @keyframes deal {
          0% {
            opacity: 0;
            transform: translate(var(--from-x, 0), -180px) rotate(var(--from-rot, 0)) scale(0.92);
          }
          60% { opacity: 1; }
          100% {
            opacity: 1;
            transform: translate(0, 0) rotate(0) scale(1);
          }
        }

        .full-grid {
          margin-top: 2rem;
          color: var(--muted, #a1a1aa);
        }
        .full-grid summary {
          cursor: pointer;
          padding: 0.5rem 0;
        }

        .project-info {
          position: sticky;
          top: calc(var(--nav-h, 56px) + 1rem);
          padding: 1.25rem;
          border: 1px solid var(--border, #27272a);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
        }
        .project-info h2 {
          margin: 0.5rem 0 0.75rem;
          font-size: 1.4rem;
        }
        .project-info p {
          color: var(--muted, #a1a1aa);
          line-height: 1.55;
          margin: 0 0 0.85rem;
        }
        .project-info .meta {
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.85rem;
          margin-top: 1rem;
        }
        .back {
          background: transparent;
          border: 0;
          color: var(--muted, #a1a1aa);
          cursor: pointer;
          padding: 0;
          font: inherit;
          transition: color 150ms ease;
        }
        .back:hover { color: var(--fg, #fff); }

        @media (max-width: 800px) {
          .project-detail {
            grid-template-columns: 1fr;
          }
          .project-info {
            position: static;
            order: -1;
          }
        }
      `}</style>
    </div>
  );
}
