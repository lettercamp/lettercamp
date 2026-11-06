import { useId, useState } from 'react';

export default function ReadingTimeCalculator({ initialWords = 600 }) {
  const inputId = useId();
  const [words, setWords] = useState(String(initialWords));
  const count = Number(words);
  const valid = words.trim() !== '' && Number.isSafeInteger(count) && count >= 0;
  const minutes = valid ? Math.ceil(count / 200) : null;

  return (
    <section aria-label="Reading time calculator" style={{ padding: 24, marginBlock: 24, borderRadius: 12, background: '#f6f6f6' }}>
      <label htmlFor={inputId} style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
        Words in your article
      </label>
      <input
        id={inputId}
        type="number"
        min="0"
        step="1"
        value={words}
        onChange={event => setWords(event.target.value)}
        aria-describedby={`${inputId}-estimate`}
        aria-invalid={!valid && words !== ''}
        style={{ width: '100%', padding: '8px 12px', font: 'inherit', border: '1px solid #ddd', borderRadius: 8 }}
      />
      <div role="group" aria-label="Example word counts" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {[300, 600, 1200].map(preset => (
          <button
            key={preset}
            type="button"
            aria-pressed={valid && count === preset}
            onClick={() => setWords(String(preset))}
            style={{ border: 0, borderRadius: 6, padding: '4px 10px', fontSize: 'var(--text-small)', background: count === preset ? '#111' : '#e9e9e9', color: count === preset ? '#fff' : '#111' }}
          >
            {preset} words
          </button>
        ))}
      </div>
      <p id={`${inputId}-estimate`} role="status" aria-live="polite" aria-atomic="true" style={{ margin: '16px 0 0' }}>
        {minutes === null
          ? 'Enter a whole number of words, zero or more.'
          : <><strong>{minutes} {minutes === 1 ? 'minute' : 'minutes'}</strong> estimated reading time</>}
      </p>
      <p style={{ margin: '4px 0 0', color: '#666', fontSize: 'var(--text-small)' }}>
        Based on 200 words per minute, rounded up to the next minute.
      </p>
    </section>
  );
}
