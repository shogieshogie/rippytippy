import { useEffect, useMemo, useState } from 'react';
import PhotoGrid, { type Photo } from './PhotoGrid';

interface PhotoWithPlace extends Photo {
  place?: string;
}

interface Props {
  photos: PhotoWithPlace[];
  places: string[];
}

export default function PhotoBrowser({ photos, places }: Props) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('place');
    if (p && places.includes(p)) setActive(p);
  }, [places]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (active) url.searchParams.set('place', active);
    else url.searchParams.delete('place');
    window.history.replaceState({}, '', url.toString());
  }, [active]);

  const filtered = useMemo(
    () => (active ? photos.filter((p) => p.place === active) : photos),
    [photos, active],
  );

  return (
    <>
      <div className="place-pills">
        <button
          type="button"
          className={`pill${active === null ? ' active' : ''}`}
          onClick={() => setActive(null)}
        >
          All
        </button>
        {places.map((place) => (
          <span key={place} className="pill-group">
            <span className="sep">|</span>
            <button
              type="button"
              className={`pill${active === place ? ' active' : ''}`}
              onClick={() => setActive((cur) => (cur === place ? null : place))}
            >
              {place}
            </button>
          </span>
        ))}
      </div>

      <PhotoGrid photos={filtered} />

      <style>{`
        .place-pills {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.25rem;
          padding: 0 1.5rem;
          margin: -0.5rem 0 1.5rem;
          color: var(--muted, #a1a1aa);
          font-size: 1rem;
        }
        .pill-group {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        .pill {
          background: transparent;
          border: 0;
          color: inherit;
          font: inherit;
          cursor: pointer;
          padding: 0.25rem 0.4rem;
          border-radius: 4px;
          transition: color 150ms ease;
        }
        .pill:hover {
          color: var(--fg, #fff);
        }
        .pill.active {
          color: var(--fg, #fff);
          font-weight: 700;
        }
        .sep {
          color: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </>
  );
}
