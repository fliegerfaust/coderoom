// Иконки одной толщины линии, нарисованы под комнату.
const s = (d: string, fill = false) =>
  `<svg viewBox="0 0 16 16" aria-hidden="true" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'}>${d}</svg>`;

export const ic = {
  play: s('<path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z"/>', true),
  stop: s('<rect x="3.5" y="3.5" width="9" height="9" rx="1.5"/>', true),
  left: s('<path d="M10 3.5 5.5 8l4.5 4.5"/>'),
  right: s('<path d="M6 3.5 10.5 8 6 12.5"/>'),
  down: s('<path d="M3.5 6 8 10.5 12.5 6"/>'),
  undo: s('<path d="M5.5 4 2.5 7l3 3"/><path d="M2.5 7h7a4 4 0 0 1 0 8H8"/>'),
  list: s('<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><path d="M2.4 4h.2M2.4 8h.2M2.4 12h.2"/>'),
  copy: s('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>'),
  minus: s('<path d="M4 8h8"/>'),
  plus: s('<path d="M4 8h8M8 4v8"/>'),
  file: s('<path d="M4 1.8h5l3 3v9.4H4z"/><path d="M9 1.8v3h3"/>'),
  invite: s('<circle cx="6.5" cy="5.5" r="2.5"/><path d="M2 13.5c.6-2.3 2.3-3.5 4.5-3.5s3.9 1.2 4.5 3.5"/><path d="M12.5 4.5v4M10.5 6.5h4"/>'),
  input: s('<path d="M2.5 4.5h11v7h-11z"/><path d="M5 8h3"/>'),
};
