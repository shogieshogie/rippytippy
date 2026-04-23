import { useEffect, useRef, useState } from 'react';

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
        {visible.map((photo) => (
          <a
            key={photo.src}
            href={photo.src}
            className="photo-cell"
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
          >
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              width={photo.width}
              height={photo.height}
            />
          </a>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="photo-sentinel" aria-hidden="true">
          <span>Loading more photos…</span>
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
      `}</style>
    </div>
  );
}
