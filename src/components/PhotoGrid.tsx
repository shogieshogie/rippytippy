import { useEffect, useRef, useState } from 'react';
import Lightbox from './Lightbox';

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

  useEffect(() => {
    setVisibleCount(Math.min(pageSize, photos.length));
  }, [photos, pageSize]);

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

  const visible = photos.slice(0, visibleCount);

  return (
    <div className="photo-grid-wrapper">
      <div className="photo-grid">
        {visible.map((photo, i) => {
          const seed = (i * 9301 + 49297) % 233280;
          const rand = seed / 233280;
          const fromX = (rand - 0.5) * 80;
          const fromRot = (rand - 0.5) * 14;
          const stagger = (i % pageSize) * 45;
          return (
            <button
              type="button"
              key={photo.src}
              className="photo-cell"
              style={
                {
                  aspectRatio: `${photo.width} / ${photo.height}`,
                  animationDelay: `${stagger}ms`,
                  ['--from-x' as string]: `${fromX}px`,
                  ['--from-rot' as string]: `${fromRot}deg`,
                } as React.CSSProperties
              }
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
          );
        })}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="photo-sentinel" aria-hidden="true">
          <span>Loading more photos…</span>
        </div>
      )}

      {openIndex !== null && (
        <Lightbox
          photos={photos}
          index={openIndex}
          onChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}

      <style>{`
        .photo-grid-wrapper {
          padding: 0 1.5rem;
        }
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0.75rem;
          perspective: 1200px;
        }
        .photo-cell {
          display: block;
          overflow: hidden;
          border-radius: 8px;
          background: #1a1a1d;
          padding: 0;
          border: 0;
          cursor: zoom-in;
          width: 100%;
          opacity: 0;
          transform-origin: 50% -40px;
          animation: deal 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          transition: transform 200ms ease;
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
        .photo-sentinel {
          display: flex;
          justify-content: center;
          padding: 3rem 0;
          color: var(--muted, #a1a1aa);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
