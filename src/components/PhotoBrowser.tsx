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
  const [active, setActive] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('place');
    if (!p) return;
    const next = new Set<string>();
    for (const v of p.split(',')) if (places.includes(v)) next.add(v);
    if (next.size > 0) setActive(next);
  }, [places]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (active.size > 0) url.searchParams.set('place', Array.from(active).join(','));
    else url.searchParams.delete('place');
    window.history.replaceState({}, '', url.toString());
  }, [active]);

  const toggle = (place: string) =>
    setActive((cur) => {
      const next = new Set(cur);
      if (next.has(place)) next.delete(place);
      else next.add(place);
      return next;
    });

  const filtered = useMemo(
    () => (active.size === 0 ? photos : photos.filter((p) => p.place && active.has(p.place))),
    [photos, active],
  );

  return (
    <>
      <div className="place-pills">
        <button
          type="button"
          className={`pill${active.size === 0 ? ' active' : ''}`}
          onClick={() => setActive(new Set())}
        >
          All
        </button>
        {places.map((place) => (
          <span key={place} className="pill-group">
            <span className="sep">|</span>
            <button
              type="button"
              className={`pill${active.has(place) ? ' active' : ''}`}
              onClick={() => toggle(place)}
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
        .pill:hover { color: var(--fg, #fff); }
        .pill.active { color: var(--fg, #fff); font-weight: 700; }
        .sep { color: rgba(255, 255, 255, 0.25); }
      `}</style>
    </>
  );
}
