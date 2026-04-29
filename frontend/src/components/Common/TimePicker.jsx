import React, { useRef, useState, useEffect, useCallback, forwardRef } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

// ─── Modern TimePicker ────────────────────────────────────────────────────────
// Drop-in replacement for bare <input type="text"> time fields.
// Usage:
//   <TimePicker value="09:30" onChange={(val) => setTime(val)} placeholder="09:00" disabled={false} />

function ScrollColumn({ items, selected, onSelect, label }) {
  const listRef = useRef(null);
  const ITEM_H = 36;
  const CENTER = 2;

  const scrollTo = useCallback((idx, behavior = 'instant') => {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: Math.max(0, idx * ITEM_H - CENTER * ITEM_H),
      behavior,
    });
  }, []);

  useEffect(() => {
    if (selected !== null) scrollTo(items.indexOf(pad(selected)));
  }, [selected, items, scrollTo]);

  const handleKeyDown = (e) => {
    const idx = selected !== null ? items.indexOf(pad(selected)) : 0;
    if (e.key === 'ArrowDown') { e.preventDefault(); onSelect(parseInt(items[(idx + 1) % items.length], 10)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); onSelect(parseInt(items[(idx - 1 + items.length) % items.length], 10)); }
  };

  const step = (dir) => {
    const idx = selected !== null ? items.indexOf(pad(selected)) : 0;
    onSelect(parseInt(items[(idx + dir + items.length) % items.length], 10));
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</span>

      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); step(-1); }}
        className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 transition rounded"
        tabIndex={-1}
      >
        <ChevronUp size={14} />
      </button>

      <div
        ref={listRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative w-14 overflow-y-scroll focus:outline-none scrollbar-hide"
        style={{ height: ITEM_H * 5 }}
      >
        <div style={{ height: CENTER * ITEM_H }} />

        {items.map((item) => {
          const isSelected = pad(selected) === item;
          return (
            <button
              key={item}
              type="button"
              tabIndex={-1}
              onMouseDown={e => {
                e.preventDefault();
                onSelect(parseInt(item, 10));
                scrollTo(items.indexOf(item), 'smooth');
              }}
              className={`
                w-full flex items-center justify-center font-mono transition-all duration-100 rounded-md
                ${isSelected
                  ? 'text-blue-600 font-bold bg-blue-50 scale-110 text-sm'
                  : 'text-gray-500 text-sm hover:text-gray-800 hover:bg-gray-100'
                }
              `}
              style={{ height: ITEM_H }}
            >
              {item}
            </button>
          );
        })}

        <div style={{ height: (5 - CENTER - 1) * ITEM_H }} />
      </div>

      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); step(1); }}
        className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 transition rounded"
        tabIndex={-1}
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

const pad = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINS = Array.from({ length: 60 }, (_, i) => pad(i));

function parseHHmm(val) {
  if (!val || val === '--') return { h: null, m: null };
  const m = val.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { h: null, m: null };
  const h = parseInt(m[1], 10);
  const mn = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mn < 0 || mn > 59) return { h: null, m: null };
  return { h, m: mn };
}

export const TimePicker = forwardRef(function TimePicker(
  { value, onChange, placeholder, disabled, readOnly, className = '' },
  _ref
) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value || '');
  const wrapRef = useRef(null);

  useEffect(() => {
    setInputVal(value && value !== '--' ? value : '');
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const { h: selH, m: selM } = parseHHmm(value);

  const commit = (hh, mm) => {
    const str = `${pad(hh)}:${pad(mm)}`;
    setInputVal(str);
    onChange(str);
  };

  const handleHourChange = (h) => {
    const { m } = parseHHmm(value);
    commit(h, m !== null ? m : 0);
  };

  const handleMinChange = (m) => {
    const { h } = parseHHmm(value);
    commit(h !== null ? h : 0, m);
  };

  const handleInputChange = (e) => {
    setInputVal(e.target.value);
  };

  const handleInputBlur = () => {
    const raw = inputVal.trim();
    if (!raw) { onChange(''); return; }
    const { h, m } = parseHHmm(raw);
    if (h !== null) {
      const str = `${pad(h)}:${pad(m)}`;
      setInputVal(str);
      onChange(str);
    } else {
      setInputVal(value && value !== '--' ? value : '');
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); }
    if (e.key === 'Escape') setOpen(false);
  };

  if (readOnly) {
    return (
      <span className={`text-xs text-gray-500 ${className}`}>
        {value && value !== '--' ? value : '--'}
      </span>
    );
  }

  return (
    <div ref={wrapRef} className={`relative inline-block ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={inputVal}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder || 'HH:mm'}
          disabled={disabled}
          className={`
            w-[88px] border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white
            focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none
            disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-300
            pr-7 transition-all
          `}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={e => { e.preventDefault(); if (!disabled) setOpen(v => !v); }}
          className="absolute right-2.5 text-gray-400 hover:text-blue-500 disabled:opacity-40 transition"
        >
          <Clock size={14} />
        </button>
      </div>

      {open && (
        <div
          className="
            absolute z-50 mt-1 left-0
            bg-white border border-gray-200 rounded-xl shadow-lg
            p-3 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100
          "
          style={{ minWidth: 148 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="relative flex items-start justify-center gap-1">
            <div
              className="absolute left-0 right-0 rounded-lg bg-blue-50/50 pointer-events-none"
              style={{ top: 28 + 36 * 2 + 4, height: 36 }}
            />

            <ScrollColumn items={HOURS} selected={selH} onSelect={handleHourChange} label="HH" />

            <div className="flex flex-col items-center justify-center self-stretch">
              <span className="text-lg font-bold text-gray-300 select-none" style={{ marginTop: 28 + 36 * 2 + 10 }}>:</span>
            </div>

            <ScrollColumn items={MINS} selected={selM} onSelect={handleMinChange} label="MM" />
          </div>

          <div className="border-t border-gray-100 pt-2 flex flex-wrap gap-1">
            {['08:00', '09:00', '10:00', '12:00', '14:00', '17:00', '18:00', '00:00'].map(t => (
              <button
                key={t}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  const { h, m } = parseHHmm(t);
                  commit(h, m);
                  setOpen(false);
                }}
                className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded transition text-gray-600"
              >
                {t}
              </button>
            ))}
          </div>

          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setOpen(false); }}
            className="w-full py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold hover:from-blue-700 hover:to-blue-800 transition shadow-sm"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
});

// Add scrollbar-hide utility if not already present
const style = document.createElement('style');
style.textContent = `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`;
document.head.appendChild(style);

export default TimePicker;