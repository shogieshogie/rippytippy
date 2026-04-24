import { useEffect, useMemo, useState } from 'react';
import Lightbox from './Lightbox';
import type { Project } from '../lib/projects';

interface Props {
  projects: Project[];
}

type View = 'overview' | 'exiting' | 'detail';

const EXIT_MS = 450;

export default function ProjectsBrowser({ projects }: Props) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [view, setView] = useState<View>('overview');
  const [openPhotoIndex, setOpenPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('project');
    if (s && projects.some((p) => p.slug === s)) {
      setActiveSlug(s);
      setView('detail');
    }
  }, [projects]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeSlug && view === 'detail') url.searchParams.set('project', activeSlug);
    else url.searchParams.delete('project');
    window.history.replaceState({}, '', url.toString());
  }, [activeSlug, view]);

  const active = useMemo(
    () => projects.find((p) => p.slug === activeSlug) ?? null,
    [projects, activeSlug],
  );

  const open = (slug: string) => {
    setActiveSlug(slug);
    setView('exiting');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => setView('detail'), EXIT_MS);
  };

  const close = () => {
    setActiveSlug(null);
    setView('overview');
  };

  return (
    <div className="projects-browser">
      <div className="project-pills">
        <button
          type="button"
          className={`pill${view !== 'detail' ? ' active' : ''}`}
          onClick={close}
        >
          Overview
        </button>
        {projects.map((p) => (
          <span key={p.slug} className="pill-group">
            <span className="sep">|</span>
            <button
              type="button"
              className={`pill${activeSlug === p.slug && view === 'detail' ? ' active' : ''}`}
              onClick={() => (activeSlug === p.slug && view === 'detail' ? close() : open(p.slug))}
            >
              {p.title}
            </button>
          </span>
        ))}
      </div>

      {view !== 'detail' && (
        <div className="cover-grid">
          {projects.map((p) => {
            const isClicked = view === 'exiting' && p.slug === activeSlug;
            const isExiting = view === 'exiting' && p.slug !== activeSlug;
            return (
              <button
                type="button"
                key={p.slug}
                className={`cover-card${isExiting ? ' exiting' : ''}${isClicked ? ' clicked' : ''}`}
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
                  <div className="cover-overlay">
                    <h2>{p.title}</h2>
                    <p className="date">{p.date}</p>
                    <p className="summary">{p.description}</p>
                  </div>
                </div>
                <div className="cover-title">{p.title}</div>
              </button>
            );
          })}
        </div>
      )}

      {view === 'detail' && active && (
        <div className="project-detail">
          <button type="button" className="back" onClick={close}>
            ← Overview
          </button>

          <div className="detail-cover">
            <div
              className="detail-cover-img"
              style={{ aspectRatio: `${active.cover.width} / ${active.cover.height}` }}
            >
              <img src={active.cover.src} alt={active.cover.alt} />
            </div>
          </div>

          <div className="detail-grid">
            {active.photos.map((photo, i) => {
              const seed = (i * 9301 + 49297) % 233280;
              const rand = seed / 233280;
              const fromX = (rand - 0.5) * 60;
              const fromRot = (rand - 0.5) * 8;
              return (
                <button
                  type="button"
                  key={photo.src}
                  className="reveal-card"
                  style={
                    {
                      aspectRatio: `${photo.width} / ${photo.height}`,
                      animationDelay: `${i * 60}ms`,
                      ['--from-x' as string]: `${fromX}px`,
                      ['--from-rot' as string]: `${fromRot}deg`,
                    } as React.CSSProperties
                  }
                  onClick={() => setOpenPhotoIndex(i)}
                  aria-label={`Open ${photo.alt}`}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading={i < 6 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === 'detail' && active && openPhotoIndex !== null && (
        <Lightbox
          photos={active.photos}
          index={openPhotoIndex}
          onChange={setOpenPhotoIndex}
          onClose={() => setOpenPhotoIndex(null)}
          sidebar={
            <>
              <h3>{active.title}</h3>
              <p className="meta">{active.date}</p>
              <p>{active.description}</p>
            </>
          }
        />
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
          gap: 0.55rem;
          transition: transform ${EXIT_MS}ms cubic-bezier(0.5, 0, 0.75, 0),
                      opacity ${EXIT_MS}ms ease;
        }
        .cover-card.exiting {
          transform: translateY(-120vh);
          opacity: 0;
          pointer-events: none;
        }
        .cover-card.clicked {
          transform: scale(1.02);
        }
        .cover-img {
          position: relative;
          overflow: hidden;
          border-radius: 8px;
          background: #1a1a1d;
        }
        .cover-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 250ms ease;
        }
        .cover-card:hover .cover-img img {
          transform: scale(1.04);
        }
        .cover-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.94);
          color: #111;
          padding: 1rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          opacity: 0;
          transition: opacity 200ms ease;
        }
        .cover-card:hover .cover-overlay,
        .cover-card:focus-visible .cover-overlay {
          opacity: 1;
        }
        .cover-overlay h2 {
          margin: 0;
          font-size: 1.15rem;
          color: #000;
        }
        .cover-overlay .date {
          margin: 0;
          font-size: 0.8rem;
          color: #555;
          letter-spacing: 0.02em;
        }
        .cover-overlay .summary {
          margin: 0.25rem 0 0;
          font-size: 0.9rem;
          line-height: 1.45;
          color: #333;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 6;
          -webkit-box-orient: vertical;
        }
        .cover-title {
          font-size: 0.95rem;
          color: var(--fg, #fff);
          padding: 0 0.15rem;
        }

        .project-detail {
          display: block;
        }
        .back {
          background: transparent;
          border: 0;
          color: var(--muted, #a1a1aa);
          cursor: pointer;
          padding: 0;
          font: inherit;
          transition: color 150ms ease;
          margin-bottom: 0.75rem;
        }
        .back:hover { color: var(--fg, #fff); }

        .detail-cover {
          margin-bottom: 0.5rem;
          position: relative;
          z-index: 2;
        }
        .detail-cover-img {
          max-width: 720px;
          margin: 0 auto;
          overflow: hidden;
          border-radius: 10px;
          background: #1a1a1d;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        }
        .detail-cover-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.6rem;
          margin-top: -1rem;
          position: relative;
          z-index: 1;
        }
        .reveal-card {
          background: #1a1a1d;
          border: 0;
          padding: 0;
          overflow: hidden;
          border-radius: 6px;
          cursor: zoom-in;
          width: 100%;
          opacity: 0;
          transform-origin: center top;
          animation: reveal-from-under 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          transition: transform 200ms ease;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        }
        .reveal-card:hover { transform: translateY(-2px); }
        .reveal-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        @keyframes reveal-from-under {
          0% {
            opacity: 0;
            transform: translate(var(--from-x, 0), -120px) rotate(var(--from-rot, 0)) scale(0.85);
          }
          50% { opacity: 1; }
          100% {
            opacity: 1;
            transform: translate(0, 0) rotate(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
