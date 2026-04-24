import { useCallback, useEffect, useRef, useState } from 'react';

export interface Photo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface Props {
  photos: Photo[];
  pageSize?: number;
}

export default function PhotoGrid({ photos, pageSize = 12 }: Props) {
  const [visibleCount, setVisibleCount] = useState(Math.min(pageSize, photos.length));
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);

  const hasMore = visibleCount < photos.length;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + pageSize, photos.length));
          }
        }
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, pageSize, photos.length]);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length],
  );
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
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
  }, [openIndex, close, next, prev]);

  useEffect(() => {
    if (openIndex === null || !filmstripRef.current) return;
    const el = filmstripRef.current.querySelector<HTMLElement>(
      `[data-thumb-index="${openIndex}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [openIndex]);

  const visible = photos.slice(0, visibleCount);
  const current = openIndex !== null ? photos[openIndex] : null;

  return (
    <div className="photo-grid-wrapper">
      <div className="photo-grid">
        {visible.map((photo, i) => (
          <button
            type="button"
            key={photo.src}
            className="photo-cell"
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            onClick={() => setOpenIndex(i)}
            aria-label={`Open ${photo.alt}`}
          >
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              width={photo.width}
              height={photo.height}
            />
          </button>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="photo-sentinel" aria-hidden="true">
          <span>Loading more photos…</span>
        </div>
      )}

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
          onClick={close}
        >
          <button
            type="button"
            className="lb-close"
            onClick={(e) => {
              e.stopPropagation();
              close();
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

          <img
            className="lb-image"
            src={current.src}
            alt={current.alt}
            onClick={(e) => e.stopPropagation()}
          />

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
                onClick={() => setOpenIndex(i)}
                aria-label={`Go to ${p.alt}`}
              >
                <img src={p.src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .photo-grid-wrapper {
          padding: 0 1.5rem;
        }
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0.75rem;
        }
        .photo-cell {
          display: block;
          overflow: hidden;
          border-radius: 8px;
          background: #1a1a1d;
          transition: transform 200ms ease;
          padding: 0;
          border: 0;
          cursor: zoom-in;
          width: 100%;
        }
        .photo-cell:hover {
          transform: translateY(-2px);
        }
        .photo-cell img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .photo-sentinel {
          display: flex;
          justify-content: center;
          padding: 3rem 0;
          color: var(--muted, #a1a1aa);
          font-size: 0.9rem;
        }

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
        .lb-image {
          grid-column: 2;
          grid-row: 1;
          justify-self: center;
          max-width: min(92vw, 1600px);
          max-height: 78vh;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          cursor: default;
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
        .lb-nav:hover,
        .lb-nav:focus-visible {
          opacity: 0.75;
        }
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

        @media (max-width: 600px) {
          .lb-nav { font-size: 2.75rem; padding: 0.5rem 0.5rem; }
          .lb-image { max-height: 70vh; }
          .lb-thumb { width: 52px; height: 36px; }
        }
      `}</style>
    </div>
  );
}
