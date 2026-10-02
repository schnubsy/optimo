// optimo's glyph set — drawn in-repo to docs/design/2026-09-27-final/spec.md §6: 24×24 viewBox, 20×20 live area,
// filled silhouettes (currentColor), 2px outer / 1px inner radii, one counter-cut where the shape needs it. The six
// style references (laptop, people, dumbbell, mug, house, book) are the Eye's samples from final.html; every other
// path is original. Nothing is traced from SF Symbols, Material, Structured or any icon library (README.md).
// Values are inner SVG markup — static constants, rendered by Icon.tsx.

export const ACTIVITY = {
  // work (6)
  'work-laptop': '<path fill-rule="evenodd" d="M5 4h14a2 2 0 0 1 2 2v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2zm1 3v6h12V7H6z"/><path d="M2 17.5h20v.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-.5z"/>',
  'work-monitor': '<path fill-rule="evenodd" d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 3v8h16V6H4z"/><path d="M9.2 18h5.6l.9 2.4a.5.5 0 0 1-.5.6H8.8a.5.5 0 0 1-.5-.6L9.2 18z"/>',
  'work-document': '<path fill-rule="evenodd" d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 11v2h8v-2H8z"/>',
  'work-briefcase': '<path fill-rule="evenodd" d="M9 3h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2zm0 2v1h6V5H9z"/>',
  'work-chart': '<rect x="3" y="12" width="4.5" height="9" rx="1.5"/><rect x="9.75" y="7" width="4.5" height="14" rx="1.5"/><rect x="16.5" y="3" width="4.5" height="18" rx="1.5"/>',
  'work-inbox-tray': '<path fill-rule="evenodd" d="M5.5 4h13a1.5 1.5 0 0 1 1.4 1l2 7V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7l2-7A1.5 1.5 0 0 1 5.5 4zM4.6 12H9a3 3 0 0 0 6 0h4.4L17.9 6.5H6.1L4.6 12z"/>',
  // meetings (5)
  'meeting-people': '<circle cx="9" cy="7.5" r="3.5"/><path d="M2.5 19.5c0-3.9 2.9-6.5 6.5-6.5s6.5 2.6 6.5 6.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-.5z"/><circle cx="16.5" cy="8.5" r="2.7"/><path d="M16.5 13.5c2.9 0 5 2.3 5 5.3v1.2a1 1 0 0 1-1 1h-3.3v-1.5c0-2-.6-3.8-1.7-5.2.3-.5.6-.8 1-.8z"/>',
  'meeting-video': '<path fill-rule="evenodd" d="M4.5 6h8a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 2 15.5v-7A2.5 2.5 0 0 1 4.5 6zm4 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/><path d="M16 10.5l4.4-2.9A1 1 0 0 1 22 8.4v7.2a1 1 0 0 1-1.6.8L16 13.5v-3z"/>',
  'meeting-phone': '<path d="M6.6 3.4c.5-.5 1.3-.5 1.8 0l2.4 2.4c.5.5.5 1.3 0 1.8l-1.3 1.3a12 12 0 0 0 5.6 5.6l1.3-1.3c.5-.5 1.3-.5 1.8 0l2.4 2.4c.5.5.5 1.3 0 1.8l-1.5 1.5c-1 1-2.6 1.3-3.9.7A18 18 0 0 1 5.9 9.3c-.6-1.3-.3-2.9.7-3.9z"/>',
  'meeting-presentation': '<path fill-rule="evenodd" d="M3 3h18a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1v9a2 2 0 0 1-2 2h-5v1.4l2.6 2.1a.8.8 0 0 1-1 1.3L12 19.2l-2.6 1.6a.8.8 0 0 1-1-1.3l2.6-2.1V17H6a2 2 0 0 1-2-2V6H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm4 8v2h6v-2H7z"/>',
  // #17: two cuffs joined by a single chevron clasp with one counter-cut (was a complex shape that blobbed at 13px)
  'meeting-handshake': '<path fill-rule="evenodd" d="M2 8a2 2 0 0 1 2-2h6.3l2.2 3h1l2.2-3H20a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6.3l-2.2-3h-1l-2.2 3H4a2 2 0 0 1-2-2V8zm9.3 3a.7.7 0 1 0 1.4 0 .7.7 0 0 0-1.4 0z"/>',
  // health / fitness (7)
  'fitness-dumbbell': '<rect x="2" y="9.5" width="3" height="5" rx="1"/><rect x="5.5" y="7" width="3.5" height="10" rx="1.2"/><rect x="9" y="10.5" width="6" height="3" rx="1"/><rect x="15" y="7" width="3.5" height="10" rx="1.2"/><rect x="19" y="9.5" width="3" height="5" rx="1"/>',
  'fitness-run': '<circle cx="15" cy="4" r="2.2"/><path d="M11.2 7.2l3.3.3a2 2 0 0 1 1.6 1.2l1.1 2.5 2.4.9a1.1 1.1 0 0 1-.8 2.1l-2.9-1.1a1.5 1.5 0 0 1-.8-.7l-.6-1.3-1.5 3.4 2.6 2.1a1.5 1.5 0 0 1 .5 1.4l-.7 3.6a1.1 1.1 0 0 1-2.2-.4l.6-3-3-2.4-1.9 3.4a1.5 1.5 0 0 1-1.2.8l-3.3.3a1.1 1.1 0 0 1-.2-2.2l2.7-.3 3.4-6.9-1.4-.1-2 2.1a1.1 1.1 0 1 1-1.6-1.5l2.3-2.5a1.5 1.5 0 0 1 1.2-.5z"/>',
  'fitness-yoga': '<circle cx="12" cy="4.5" r="2.3"/><path d="M12 8c1.4 0 2.5 1.1 2.5 2.5v2.6l3.8 1.9a1.2 1.2 0 0 1-1 2.2l-2.9-1.4H9.6l-2.9 1.4a1.2 1.2 0 0 1-1-2.2l3.8-1.9v-2.6C9.5 9.1 10.6 8 12 8z"/><rect x="3" y="18.5" width="18" height="2.5" rx="1.25"/>',
  'fitness-bike': '<path fill-rule="evenodd" d="M6 10a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM18 10a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z"/><path d="M10.5 4h3a1 1 0 0 1 0 2h-.8l1.9 4.4-3.9 5.3-1.6-1.2 3.2-4.3L11 6h-.5a1 1 0 0 1 0-2z"/>',
  'fitness-swim': '<circle cx="16.5" cy="6" r="2.5"/><path d="M4.5 9.2 9 7.5a1.5 1.5 0 0 1 1.7.5l3 4.1-1.9 1.4-2.3-3.1-3.9 1.5a1.1 1.1 0 0 1-.8-2z"/><path d="M2 16.2c1.7 0 2.5-1.2 5-1.2s3.3 1.2 5 1.2 2.5-1.2 5-1.2 3.3 1.2 5 1.2V19c-1.7 0-2.5-1.2-5-1.2S13.7 19 12 19s-2.5-1.2-5-1.2S3.7 19 2 19v-2.8z"/>',
  'fitness-heart': '<path fill-rule="evenodd" d="M12 20.5 4.2 13A5.3 5.3 0 0 1 12 5.9 5.3 5.3 0 0 1 19.8 13L12 20.5zM6 12.2h3l1.2-2 2 4 1.3-2h4.5v1.6h-3.6l-2.2 3.2-2-4-.4.8H6v-1.6z"/>',
  'health-pill': '<path fill-rule="evenodd" d="M14.6 3.6a4.9 4.9 0 0 1 6.9 6.9l-11 11a4.9 4.9 0 0 1-6.9-6.9l11-11zM8.3 9.7l6 6 5.8-5.8a3 3 0 0 0-4.2-4.2L8.3 9.7z"/>',
  // food / drink (6)
  'food-coffee': '<path d="M3 9a1 1 0 0 1 1-1h12v7.5A4.5 4.5 0 0 1 11.5 20h-4A4.5 4.5 0 0 1 3 15.5V9z"/><path fill-rule="evenodd" d="M16 10h2a3.5 3.5 0 0 1 0 7h-2v-2.2h2a1.3 1.3 0 0 0 0-2.6h-2V10z"/><rect x="6.5" y="3" width="2" height="3.5" rx="1"/><rect x="10.5" y="3" width="2" height="3.5" rx="1"/>',
  // #17: a wider 16px plate rim with a tapered knife blade + distinct fork tines (was three plain bars → "IOI")
  'food-plate': '<path fill-rule="evenodd" d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/><path d="M3.6 4c1.1 0 1.9.8 1.9 2.1v5.2c0 1.2-.5 2-1.1 2.4v6.5a.8.8 0 0 1-1.6 0v-6.5c-.6-.4-1.1-1.2-1.1-2.4V6.1C1.7 4.8 2.5 4 3.6 4z"/><path d="M19 4h.9v4.6h.9V4h.9v4.6h.9V4h.9v5.6c0 1.1-.5 1.8-1.2 2.2v6.6a.8.8 0 0 1-1.6 0v-6.6c-.7-.4-1.2-1.1-1.2-2.2V4z"/>',
  'food-bowl': '<path d="M2.6 11h18.8a1 1 0 0 1 1 1.1A10.5 10.5 0 0 1 16 20v.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V20a10.5 10.5 0 0 1-6.4-7.9 1 1 0 0 1 1-1.1z"/><rect x="7" y="3" width="2" height="6" rx="1"/><rect x="11" y="2" width="2" height="7" rx="1"/><rect x="15" y="3" width="2" height="6" rx="1"/>',
  'food-water': '<path fill-rule="evenodd" d="M12 2.5c.4 0 .7.2.9.5 1.6 2.4 6.1 7.9 6.1 11.5a7 7 0 0 1-14 0c0-3.6 4.5-9.1 6.1-11.5.2-.3.5-.5.9-.5zM8.2 14.2a1 1 0 0 0-1 1 4.8 4.8 0 0 0 4.1 4.3 1 1 0 0 0 .3-2 2.8 2.8 0 0 1-2.4-2.5 1 1 0 0 0-1-.8z"/>',
  'food-apple': '<path d="M12 7.5c1.5-1 3.3-1.5 5-1 3 .9 4.2 4.4 3.3 8C19.4 18 17 21 14.8 21c-1.2 0-1.8-.6-2.8-.6s-1.6.6-2.8.6C7 21 4.6 18 3.7 14.5c-.9-3.6.3-7.1 3.3-8 1.7-.5 3.5 0 5 1z"/><path d="M12.5 6.5c0-2.2 1.3-4 3.5-4.5.2 2.3-1.2 4.2-3.5 4.5z"/>',
  'food-wine': '<path fill-rule="evenodd" d="M7 2h10a1 1 0 0 1 1 .9l.5 5.1A6.5 6.5 0 0 1 13 15v4.5h3a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2h3V15a6.5 6.5 0 0 1-5.5-7l.5-5.1A1 1 0 0 1 7 2zm.9 2-.3 3.5h8.8L16.1 4H7.9z"/>',
  // home / chores (6)
  'home-house': '<path fill-rule="evenodd" d="M11.3 3.3a1 1 0 0 1 1.4 0l8.5 8a1 1 0 0 1-.7 1.7H19v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7H3.5a1 1 0 0 1-.7-1.7l8.5-8zM10 14.5V20h4v-5.5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1z"/>',
  'home-broom': '<path d="M17.3 2.3a1 1 0 0 1 1.4 1.4l-4.6 4.6 1.8 1.8a1 1 0 0 1 0 1.4l-.9.9-5.5-5.5.9-.9a1 1 0 0 1 1.4 0l1.8 1.8 4.6-4.6z"/><path d="M8.6 8.3l5.6 5.6-2.3 6.6a1 1 0 0 1-1.6.4L3.1 13.7a1 1 0 0 1 .4-1.6l5.1-3.8z"/>',
  'home-laundry': '<path fill-rule="evenodd" d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm6 7a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/>',
  'home-tools': '<path d="M20.3 6.2a5.5 5.5 0 0 1-7 6.9l-7 7a2 2 0 0 1-2.9-2.9l7-7a5.5 5.5 0 0 1 6.9-7l-3.1 3.1.5 2.9 2.9.5 2.7-3.5z"/>',
  'home-plant': '<path d="M6 13h12l-1.4 7.3a2 2 0 0 1-2 1.7H9.4a2 2 0 0 1-2-1.7L6 13z"/><path d="M11 12V9.5C8 9.5 5.5 7.3 5.5 4c3 0 5.5 2.2 5.5 5.5V12h2V8.5C13 5.2 15.5 3 18.5 3c0 3.3-2.5 5.5-5.5 5.5V12h-2z"/>',
  'home-trash': '<path d="M9 2h6a1 1 0 0 1 1 1v1h4a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1z"/><path fill-rule="evenodd" d="M5 8h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8zm6 3v7h2v-7h-2z"/>',
  // family (4)
  // #17: two figures, one counter-cut — the heart is dropped (it blobbed into the front figure at 13px)
  'family-heart-people': '<path fill-rule="evenodd" d="M7 2.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM2.5 20v-5.5A4.5 4.5 0 0 1 7 10a4.5 4.5 0 0 1 4.5 4.5V20a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1zm3.3-7.3a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/><path d="M17 3a2.2 2.2 0 1 1 0 4.4A2.2 2.2 0 0 1 17 3zm-4 15.5v-4A4 4 0 0 1 17 10.5a4 4 0 0 1 4 4v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1z"/>',
  'family-child': '<circle cx="12" cy="6" r="3.5"/><path d="M7 14.5a5 5 0 0 1 10 0V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5.5z"/><rect x="2.5" y="10.5" width="4" height="2" rx="1" transform="rotate(-25 4.5 11.5)"/><rect x="17.5" y="10.5" width="4" height="2" rx="1" transform="rotate(25 19.5 11.5)"/>',
  'family-gift': '<path fill-rule="evenodd" d="M4 8h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm7 0v13h2V8h-2z"/><path d="M12 7.5C10.5 4 7 3.3 6.5 5c-.5 1.7 2.5 2.5 5.5 2.5zm0 0c1.5-3.5 5-4.2 5.5-2.5.5 1.7-2.5 2.5-5.5 2.5z"/>',
  'family-cake': '<path fill-rule="evenodd" d="M5 11h14a2 2 0 0 1 2 2v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a2 2 0 0 1 2-2zm0 4v1.8h14V15H5z"/><rect x="7" y="5" width="2" height="4.5" rx="1"/><rect x="11" y="4" width="2" height="5.5" rx="1"/><rect x="15" y="5" width="2" height="4.5" rx="1"/>',
  // errands / transport (6)
  'errand-bag': '<path fill-rule="evenodd" d="M12 2a4 4 0 0 1 4 4v1h2.2a1 1 0 0 1 1 .9l1 12A1.9 1.9 0 0 1 18.3 22H5.7a1.9 1.9 0 0 1-1.9-2.1l1-12a1 1 0 0 1 1-.9H8V6a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2z"/>',
  'errand-cart': '<path d="M2 4a1 1 0 0 1 1-1h1.8a1.5 1.5 0 0 1 1.5 1.2L6.6 6H20a1 1 0 0 1 1 1.2l-1.4 6.5a2 2 0 0 1-2 1.6H8.3l.3 1.7H18a1 1 0 0 1 0 2H7.8a1.5 1.5 0 0 1-1.5-1.2L4 5H3a1 1 0 0 1-1-1z"/><circle cx="9" cy="20.5" r="1.5"/><circle cx="17" cy="20.5" r="1.5"/>',
  'errand-car': '<path fill-rule="evenodd" d="M7.3 5h9.4a2 2 0 0 1 1.9 1.4L20 11h.5a1.5 1.5 0 0 1 1.5 1.5V17a1 1 0 0 1-1 1h-1v1.5a1.5 1.5 0 0 1-3 0V18H7v1.5a1.5 1.5 0 0 1-3 0V18H3a1 1 0 0 1-1-1v-4.5A1.5 1.5 0 0 1 3.5 11H4l1.4-4.6A2 2 0 0 1 7.3 5zm.2 2-1.2 4h11.4l-1.2-4h-9z"/>',
  'errand-bus': '<path fill-rule="evenodd" d="M6 2h12a2 2 0 0 1 2 2v14a1 1 0 0 1-1 1v1.5a1.5 1.5 0 0 1-3 0V19H8v1.5a1.5 1.5 0 0 1-3 0V19a1 1 0 0 1-1-1V4a2 2 0 0 1 2-2zm0 4v6h12V6H6z"/>',
  'errand-package': '<path d="M4 4h16a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1z"/><path fill-rule="evenodd" d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9zm5 2.5v2h6v-2H9z"/>',
  'errand-pin': '<path fill-rule="evenodd" d="M12 2a7.5 7.5 0 0 1 7.5 7.5c0 5-5.6 10.8-6.8 12a1 1 0 0 1-1.4 0C10.1 20.3 4.5 14.5 4.5 9.5A7.5 7.5 0 0 1 12 2zm0 4.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
  // learning (5)
  'learn-book': '<path d="M3 5.2A1.2 1.2 0 0 1 4.2 4c2.6 0 5 .8 6.8 2.3v13.2C9.2 18.2 6.8 17.5 4.2 17.5A1.2 1.2 0 0 1 3 16.3V5.2z"/><path d="M21 5.2A1.2 1.2 0 0 0 19.8 4c-2.6 0-5 .8-6.8 2.3v13.2c1.8-1.3 4.2-2 6.8-2a1.2 1.2 0 0 0 1.2-1.2V5.2z"/>',
  'learn-graduation': '<path d="M11.6 3.1a1 1 0 0 1 .8 0l10 4.4a.8.8 0 0 1 0 1.5l-10 4.4a1 1 0 0 1-.8 0l-10-4.4a.8.8 0 0 1 0-1.5l10-4.4z"/><path d="M6 12.6l5.2 2.3a2 2 0 0 0 1.6 0l5.2-2.3V17c0 1.7-2.7 3.5-6 3.5S6 18.7 6 17v-4.4z"/><rect x="20" y="9" width="1.6" height="7" rx=".8"/>',
  'learn-pencil': '<path fill-rule="evenodd" d="M16.3 2.9a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8L9 19.8l-5.6 1.6a.7.7 0 0 1-.8-.8L4.2 15 16.3 2.9zM14.8 7l2.2 2.2 1.4-1.4-2.2-2.2L14.8 7z"/>',
  'learn-code': '<path d="M8.3 6.3a1.2 1.2 0 0 1 0 1.7L4.4 12l3.9 4a1.2 1.2 0 0 1-1.7 1.7L1.9 12.9a1.2 1.2 0 0 1 0-1.8l4.7-4.8a1.2 1.2 0 0 1 1.7 0zM15.7 6.3a1.2 1.2 0 0 1 1.7 0l4.7 4.8a1.2 1.2 0 0 1 0 1.8l-4.7 4.8a1.2 1.2 0 0 1-1.7-1.7l3.9-4-3.9-4a1.2 1.2 0 0 1 0-1.7z"/><rect x="11" y="4" width="2.4" height="16" rx="1.2" transform="rotate(15 12.2 12)"/>',
  'learn-language': '<path fill-rule="evenodd" d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 5v2h10V8H7z"/>',
  // rest / sleep (4)
  'rest-bed': '<path d="M2 6a1 1 0 0 1 2 0v7h18v6a1 1 0 0 1-2 0v-2H4v2a1 1 0 0 1-2 0V6z"/><path d="M11 8h8a3 3 0 0 1 3 3v1H11V8z"/><circle cx="7.5" cy="10" r="2"/>',
  'rest-moon': '<path d="M14.5 2.5A9.5 9.5 0 1 0 21.5 16 7.5 7.5 0 0 1 14.5 2.5z"/>',
  'rest-sofa': '<path d="M5 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4.2a3 3 0 0 0-2 2.8v1H7v-1a3 3 0 0 0-2-2.8V6z"/><path d="M2 13a2 2 0 0 1 4 0v3h12v-3a2 2 0 0 1 4 0v5a2 2 0 0 1-2 2v1a1 1 0 0 1-2 0v-1H6v1a1 1 0 0 1-2 0v-1a2 2 0 0 1-2-2v-5z"/>',
  'rest-alarm': '<path fill-rule="evenodd" d="M12 4a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm-1 4v5.4l3.6 2.1 1-1.7-2.6-1.5V8h-2z"/><path d="M2.6 6.3 6.3 2.6a1 1 0 0 1 1.4 1.4L4 7.7a1 1 0 0 1-1.4-1.4zM17.7 2.6l3.7 3.7A1 1 0 0 1 20 7.7L16.3 4a1 1 0 0 1 1.4-1.4z"/>',
  // personal care (4)
  'care-shower': '<path d="M4 21V7a4 4 0 0 1 7.7-1.5A4.5 4.5 0 0 1 16 10v1.5H7V10a4.5 4.5 0 0 1 2.9-4.2A2 2 0 0 0 6 7v14a1 1 0 0 1-2 0z"/><circle cx="8.5" cy="15" r="1.2"/><circle cx="12" cy="14.5" r="1.2"/><circle cx="15.5" cy="15" r="1.2"/><circle cx="10" cy="18.5" r="1.2"/><circle cx="14" cy="18.5" r="1.2"/>',
  'care-toothbrush': '<path d="M9.4 12.2l9-9a1.5 1.5 0 0 1 2.1 2.1l-9 9-2.1-2.1z"/><path fill-rule="evenodd" d="M3 14a2 2 0 0 1 2-2h3.5l3.5 3.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5zm2 2v1h4v-1H5z"/>',
  'care-scissors': '<path fill-rule="evenodd" d="M6.5 13a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM6.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/><path d="M9.2 10.3 20.2 4a1 1 0 0 1 1 1.7L11.3 12l9.9 6.3a1 1 0 0 1-1 1.7l-11-6.3.9-1.7-.9-1.7z"/>',
  // #17: an oval mirror head on a short flared stand (was a round head on a thin stick — a "lollipop", too close
  // to errand-pin's teardrop-on-a-point)
  'care-mirror': '<path fill-rule="evenodd" d="M12 1.5a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M9.5 14.8h5v2.7l1.8 2a.8.8 0 0 1-.6 1.3H8.3a.8.8 0 0 1-.6-1.3l1.8-2v-2.7z"/>',
  // finance (3)
  'finance-wallet': '<path fill-rule="evenodd" d="M5 4h12a2 2 0 0 1 2 2v1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm11 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 6a1 1 0 0 0 0 2h12V6H5z"/>',
  'finance-bank': '<path d="M11.5 2.2a1 1 0 0 1 1 0l8.5 4.9A1 1 0 0 1 20.5 9h-17A1 1 0 0 1 3 7.1l8.5-4.9z"/><rect x="5" y="10.5" width="2.5" height="7" rx="1"/><rect x="10.75" y="10.5" width="2.5" height="7" rx="1"/><rect x="16.5" y="10.5" width="2.5" height="7" rx="1"/><rect x="3" y="19" width="18" height="2.5" rx="1"/>',
  'finance-receipt': '<path fill-rule="evenodd" d="M5 2h14a1 1 0 0 1 1 1v18.2a.6.6 0 0 1-1 .5l-2-1.5-2.3 1.6a1 1 0 0 1-1.2 0L12 20.2l-1.5 1.6a1 1 0 0 1-1.2 0L7 20.2l-2 1.5a.6.6 0 0 1-1-.5V3a1 1 0 0 1 1-1zm3 5v2h8V7H8z"/>',
  // travel (3)
  'travel-plane': '<path d="M21.3 2.7a2 2 0 0 1 0 2.8l-4.1 4.1 2.2 9.5a1 1 0 0 1-.3 1l-1 1a.7.7 0 0 1-1.1-.2l-3.9-7.8-3.3 3.3.4 2.7a1 1 0 0 1-.3.9l-.8.8a.7.7 0 0 1-1.1-.2l-1.5-3.1-3.1-1.5a.7.7 0 0 1-.2-1.1l.8-.8a1 1 0 0 1 .9-.3l2.7.4 3.3-3.3-7.8-3.9A.7.7 0 0 1 2.6 6l1-1a1 1 0 0 1 1-.3l9.5 2.2 4.1-4.1a2 2 0 0 1 2.8 0z"/>',
  'travel-suitcase': '<path fill-rule="evenodd" d="M9 2h6a1 1 0 0 1 1 1v3h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2v.5a1 1 0 0 1-2 0V21H8v.5a1 1 0 0 1-2 0V21a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1zm1 2v2h4V4h-4z"/>',
  'travel-train': '<path fill-rule="evenodd" d="M7 2h10a3 3 0 0 1 3 3v10a3 3 0 0 1-2.2 2.9l1.9 2.6a.9.9 0 0 1-1.4 1L15.9 18H8.1l-2.4 3.5a.9.9 0 0 1-1.4-1l1.9-2.6A3 3 0 0 1 4 15V5a3 3 0 0 1 3-3zM6.5 6v4.5h11V6h-11z"/>',
  // pets (2)
  'pet-paw': '<ellipse cx="12" cy="16" rx="5" ry="4.5"/><circle cx="5" cy="10.5" r="2.2"/><circle cx="9" cy="6" r="2.2"/><circle cx="15" cy="6" r="2.2"/><circle cx="19" cy="10.5" r="2.2"/>',
  'pet-bone': '<path d="M6.3 3.2a2.8 2.8 0 0 1 3.4 3.4l7.7 7.7a2.8 2.8 0 1 1 3.4 3.4 2.8 2.8 0 1 1-3.4 3.4 2.8 2.8 0 0 1 0-3.4L9.7 10a2.8 2.8 0 0 1-3.4 0A2.8 2.8 0 1 1 2.9 6.6 2.8 2.8 0 1 1 6.3 3.2z"/>',
  // creative (3)
  'creative-music': '<path d="M20 3.2V16a3.5 3.5 0 1 1-2-3.2V7.4l-8 1.9V18a3.5 3.5 0 1 1-2-3.2V6.4a1 1 0 0 1 .8-1l10-2.3A1 1 0 0 1 20 3.2z"/>',
  'creative-camera': '<path fill-rule="evenodd" d="M9 3.5h6a1 1 0 0 1 .9.6L16.8 6H19a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h2.2l.9-1.9A1 1 0 0 1 9 3.5zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
  'creative-palette': '<path fill-rule="evenodd" d="M12 2.5c5.5 0 9.5 3.8 9.5 8.3 0 3-2.3 4.7-4.8 4.7h-1.9a1.6 1.6 0 0 0-1.2 2.7 1.7 1.7 0 0 1-1.3 2.8H12A9.5 9.5 0 0 1 12 2.5zm-5 7a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z"/>',
} as const

/** Chrome glyphs: filled (active) and outline (inactive, 1.75px stroke of the same silhouette). */
export const CHROME = {
  'ui-inbox': '<path fill-rule="evenodd" d="M4 4h16a1 1 0 0 1 1 1v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zm1 9v5h14v-5h-3.5a3.5 3.5 0 0 1-7 0H5z"/>',
  // #16: two offset stacked pills with a small left chip, echoing the brand mark (was a note/message card)
  'ui-timeline': '<circle cx="5" cy="9" r="2.3"/><rect x="8.5" y="6.5" width="12.5" height="5.5" rx="2.75"/><rect x="10.5" y="14.5" width="10" height="5.5" rx="2.75"/>',
  // #16: a calendar frame with a solid header band joining 3 column counter-cuts (was three loose capsules)
  'ui-week': '<rect x="3" y="4" width="18" height="5" rx="2"/><rect x="3" y="8" width="5" height="12" rx="1.5"/><rect x="9.5" y="8" width="5" height="12" rx="1.5"/><rect x="16" y="8" width="5" height="12" rx="1.5"/>',
  'ui-settings': '<path fill-rule="evenodd" d="M10.3 2.5h3.4l.5 2.3 1.9.8 2-1.3 2.4 2.4-1.3 2 .8 1.9 2.3.5v3.4l-2.3.5-.8 1.9 1.3 2-2.4 2.4-2-1.3-1.9.8-.5 2.3h-3.4l-.5-2.3-1.9-.8-2 1.3-2.4-2.4 1.3-2-.8-1.9-2.3-.5v-3.4l2.3-.5.8-1.9-1.3-2 2.4-2.4 2 1.3 1.9-.8.5-2.3zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>',
  'ui-plan': '<path d="M11 2.5a1 1 0 0 1 2 0c.4 3.9 2.6 6.1 6.5 6.5a1 1 0 0 1 0 2c-3.9.4-6.1 2.6-6.5 6.5a1 1 0 0 1-2 0c-.4-3.9-2.6-6.1-6.5-6.5a1 1 0 0 1 0-2c3.9-.4 6.1-2.6 6.5-6.5z"/><path d="M18.5 15.5a.7.7 0 0 1 1.4 0c.2 1.6 1 2.4 2.6 2.6a.7.7 0 0 1 0 1.4c-1.6.2-2.4 1-2.6 2.6a.7.7 0 0 1-1.4 0c-.2-1.6-1-2.4-2.6-2.6a.7.7 0 0 1 0-1.4c1.6-.2 2.4-1 2.6-2.6z"/>',
  'ui-plus': '<path d="M12 3.5a1.5 1.5 0 0 1 1.5 1.5v5.5H19a1.5 1.5 0 0 1 0 3h-5.5V19a1.5 1.5 0 0 1-3 0v-5.5H5a1.5 1.5 0 0 1 0-3h5.5V5A1.5 1.5 0 0 1 12 3.5z"/>',
  'ui-check': '<path d="M9.5 16.2 5.3 12a1.3 1.3 0 0 0-1.8 1.8l5.1 5.1a1.3 1.3 0 0 0 1.8 0L20.5 8.8A1.3 1.3 0 0 0 18.7 7L9.5 16.2z"/>',
  'ui-chevron-left': '<path d="M15.1 4.4a1.5 1.5 0 0 1 0 2.1L9.6 12l5.5 5.5a1.5 1.5 0 0 1-2.1 2.1l-6.6-6.5a1.5 1.5 0 0 1 0-2.2L13 4.4a1.5 1.5 0 0 1 2.1 0z"/>',
  'ui-chevron-right': '<path d="M8.9 4.4a1.5 1.5 0 0 1 2.1 0l6.6 6.5a1.5 1.5 0 0 1 0 2.2L11 19.6a1.5 1.5 0 0 1-2.1-2.1l5.5-5.5-5.5-5.5a1.5 1.5 0 0 1 0-2.1z"/>',
  'ui-close': '<path d="M5.4 5.4a1.5 1.5 0 0 1 2.1 0L12 9.9l4.5-4.5a1.5 1.5 0 0 1 2.1 2.1L14.1 12l4.5 4.5a1.5 1.5 0 0 1-2.1 2.1L12 14.1l-4.5 4.5a1.5 1.5 0 0 1-2.1-2.1L9.9 12 5.4 7.5a1.5 1.5 0 0 1 0-2.1z"/>',
  'ui-drag-handle': '<circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/>',
  'ui-search': '<path fill-rule="evenodd" d="M10.5 3a7.5 7.5 0 0 1 6 12l4.2 4.2a1.3 1.3 0 0 1-1.8 1.8l-4.2-4.2A7.5 7.5 0 1 1 10.5 3zm0 2.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>',
} as const

export type ActivityName = keyof typeof ACTIVITY
export type ChromeName = keyof typeof CHROME
export type IconName = ActivityName | ChromeName

/** Picker groups, in spec §6.2 order. */
export const ICON_GROUPS: { id: string; label: string; icons: ActivityName[] }[] = [
  { id: 'work', label: 'Work', icons: ['work-laptop', 'work-monitor', 'work-document', 'work-briefcase', 'work-chart', 'work-inbox-tray'] },
  { id: 'meetings', label: 'Meetings', icons: ['meeting-people', 'meeting-video', 'meeting-phone', 'meeting-presentation', 'meeting-handshake'] },
  { id: 'health', label: 'Health & fitness', icons: ['fitness-dumbbell', 'fitness-run', 'fitness-yoga', 'fitness-bike', 'fitness-swim', 'fitness-heart', 'health-pill'] },
  { id: 'food', label: 'Food & drink', icons: ['food-coffee', 'food-plate', 'food-bowl', 'food-water', 'food-apple', 'food-wine'] },
  { id: 'home', label: 'Home & chores', icons: ['home-house', 'home-broom', 'home-laundry', 'home-tools', 'home-plant', 'home-trash'] },
  { id: 'family', label: 'Family', icons: ['family-heart-people', 'family-child', 'family-gift', 'family-cake'] },
  { id: 'errands', label: 'Errands & transport', icons: ['errand-bag', 'errand-cart', 'errand-car', 'errand-bus', 'errand-package', 'errand-pin'] },
  { id: 'learning', label: 'Learning', icons: ['learn-book', 'learn-graduation', 'learn-pencil', 'learn-code', 'learn-language'] },
  { id: 'rest', label: 'Rest & sleep', icons: ['rest-bed', 'rest-moon', 'rest-sofa', 'rest-alarm'] },
  { id: 'care', label: 'Personal care', icons: ['care-shower', 'care-toothbrush', 'care-scissors', 'care-mirror'] },
  { id: 'finance', label: 'Finance', icons: ['finance-wallet', 'finance-bank', 'finance-receipt'] },
  { id: 'travel', label: 'Travel', icons: ['travel-plane', 'travel-suitcase', 'travel-train'] },
  { id: 'pets', label: 'Pets', icons: ['pet-paw', 'pet-bone'] },
  { id: 'creative', label: 'Creative', icons: ['creative-music', 'creative-camera', 'creative-palette'] },
]

/**
 * Names stored before arc 2 (the Switchboard line set) keep resolving: categories and settings carry these strings.
 * Presentation only — no row is rewritten.
 */
export const LEGACY: Record<string, IconName> = {
  dot: 'work-document', check: 'ui-check', plus: 'ui-plus', close: 'ui-close', inbox: 'ui-inbox', repeat: 'ui-timeline',
  clock: 'rest-alarm', calendar: 'ui-week', bell: 'rest-alarm', flag: 'errand-pin', pin: 'errand-pin', star: 'fitness-heart',
  focus: 'ui-timeline', idea: 'ui-plan', trash: 'home-trash', work: 'work-laptop', meet: 'meeting-people', laptop: 'work-laptop',
  code: 'learn-code', mail: 'work-inbox-tray', phone: 'meeting-phone', chat: 'learn-language', pen: 'learn-pencil',
  chart: 'work-chart', money: 'finance-wallet', health: 'fitness-dumbbell', run: 'fitness-run', gym: 'fitness-dumbbell',
  bike: 'fitness-bike', walk: 'fitness-run', sleep: 'rest-bed', pill: 'health-pill', heart: 'fitness-heart', water: 'food-water',
  home: 'home-house', family: 'family-heart-people', kid: 'family-child', kids: 'family-child', pet: 'pet-paw', plant: 'home-plant',
  clean: 'home-broom', tools: 'home-tools', gift: 'family-gift', meal: 'food-plate', lunch: 'food-plate', coffee: 'food-coffee',
  cook: 'food-bowl', errand: 'errand-bag', cart: 'errand-cart', shop: 'errand-cart', car: 'errand-car', train: 'travel-train',
  plane: 'travel-plane', learn: 'learn-book', read: 'learn-book', music: 'creative-music', game: 'rest-sofa', film: 'rest-sofa',
  camera: 'creative-camera', sun: 'rest-alarm', call: 'meeting-phone',
}

export function resolveIcon(name: string | null | undefined): IconName {
  if (!name) return 'work-document'
  if (name in ACTIVITY || name in CHROME) return name as IconName
  return LEGACY[name] ?? 'work-document'
}
