import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Photo } from './PhotoGrid';

interface Props {
  photos: Photo[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
  sidebar?: ReactNode;
}

export default function Lightbox({ photos, index, onChange, onClose, sidebar }: Props) {
  const filmstripRef = useRef<HTMLDivElement | null>(null);

  const next = useCallback(
    () => onChange((index + 1) % photos.length),
    [index, photos.length, onChange],
  );
  const prev = useCallback(
    () => onChange((index - 1 + photos.length) % photos.length),
    [index, photos.length, onChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, next, prev]);

  useEffect(() => {
    const el = filmstripRef.current?.querySelector<HTMLElement>(
      `[data-thumb-index="${index}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [index]);

  const current = photos[index];
  if (!current) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={current.alt}
      onClick={onClose}
    >
      <button
        type="button"
        className="lb-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        ×
      </button>

      <button
        type="button"
        className="lb-nav lb-prev"
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        aria-label="Previous photo"
      >
        ‹
      </button>

      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <img className="lb-image" src={current.src} alt={current.alt} />
        {sidebar && <aside className="lb-sidebar">{sidebar}</aside>}
      </div>

      <button
        type="button"
        className="lb-nav lb-next"
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        aria-label="Next photo"
      >
        ›
      </button>

      <div
        ref={filmstripRef}
        className="lb-filmstrip"
        onClick={(e) => e.stopPropagation()}
      >
        {photos.map((p, i) => (
          <button
            type="button"
            key={p.src}
            data-thumb-index={i}
            className="lb-thumb"
            onClick={() => onChange(i)}
            aria-label={`Go to ${p.alt}`}
          >
            <img src={p.src} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      <style>{`
        .lightbox {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.92);
          z-index: 1000;
          display: grid;
          grid-template-columns: auto 1fr auto;
          grid-template-rows: 1fr auto;
          align-items: center;
          animation: lb-fade 160ms ease-out;
        }
        @keyframes lb-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .lb-stage {
          grid-column: 2;
          grid-row: 1;
          display: flex;
          gap: 1.5rem;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          max-width: 100%;
          min-width: 0;
        }
        .lb-image {
          max-width: min(70vw, 1400px);
          max-height: 78vh;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          cursor: default;
        }
        .lb-sidebar {
          flex: 0 0 320px;
          max-height: 78vh;
          overflow-y: auto;
          color: #e7e7ea;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 1.25rem 1.5rem;
          line-height: 1.55;
        }
        .lb-sidebar h3 {
          margin: 0 0 0.5rem;
          font-size: 1.2rem;
        }
        .lb-sidebar p {
          margin: 0 0 0.85rem;
          color: #c7c7cc;
        }
        .lb-sidebar .meta {
          color: rgba(255, 255, 255, 0.45);
          font-size: 0.85rem;
        }
        .lb-nav {
          background: transparent;
          border: 0;
          color: #fff;
          font-size: 4rem;
          line-height: 1;
          cursor: pointer;
          padding: 1rem 1.25rem;
          opacity: 0.2;
          transition: opacity 150ms ease;
          user-select: none;
        }
        .lb-nav:hover, .lb-nav:focus-visible { opacity: 0.75; }
        .lb-prev { grid-column: 1; grid-row: 1; }
        .lb-next { grid-column: 3; grid-row: 1; }
        .lb-close {
          position: absolute;
          top: 0.5rem;
          right: 1rem;
          background: transparent;
          border: 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 2.5rem;
          line-height: 1;
          cursor: pointer;
          padding: 0.25rem 0.75rem;
          z-index: 1;
        }
        .lb-close:hover { color: #fff; }

        .lb-filmstrip {
          grid-column: 1 / -1;
          grid-row: 2;
          display: flex;
          gap: 0.4rem;
          padding: 0.75rem 1rem;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          opacity: 0.35;
          transition: opacity 200ms ease;
        }
        .lb-filmstrip::-webkit-scrollbar { display: none; }
        .lb-filmstrip:hover { opacity: 0.75; }
        .lb-thumb {
          flex: 0 0 auto;
          width: 64px;
          height: 44px;
          padding: 0;
          border: 0;
          border-radius: 3px;
          overflow: hidden;
          background: #111;
          cursor: pointer;
          opacity: 0.85;
        }
        .lb-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        @media (max-width: 900px) {
          .lb-stage { flex-direction: column; gap: 0.75rem; padding: 0.5rem; }
          .lb-image { max-width: 92vw; max-height: 55vh; }
          .lb-sidebar { flex: none; max-height: 22vh; padding: 0.75rem 1rem; }
        }
        @media (max-width: 600px) {
          .lb-nav { font-size: 2.75rem; padding: 0.5rem; }
          .lb-thumb { width: 52px; height: 36px; }
        }
      `}</style>
    </div>
  );
}
