// dltPreflight.js — check an SMS against its registered DLT template before sending.
// No dependencies. Node 18+.

// Value rules per variable tag. These are a pre-flight check, not the operator's
// scrubbing algorithm. Confirm the exact rules with your DLT portal and adjust.
const TAG_RULES = {
  numeric:      { pattern: /^[0-9]+$/,                          desc: 'digits only' },
  alphanumeric: { pattern: /^[A-Za-z0-9]+$/,                   desc: 'letters and digits' },
  url:          { pattern: /^https?:\/\/[^\s]+$/i,              desc: 'an http(s) link' },
  urlott:       { pattern: /^https?:\/\/[^\s]+$/i,              desc: 'an app/OTT link' },
  cbn:          { pattern: /^\+?[0-9]{8,13}$/,                  desc: 'a callback number' },
  email:        { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,        desc: 'an email address' },
};

const TAG_RE = /\{#([a-z]+)#\}/g;
const MAX_VAR_LENGTH = 30; // adjust to what your DLT portal enforces

// Split a registered template into fixed text and tagged slots.
function parseTemplate(template) {
  const parts = [];
  let last = 0;
  for (const m of template.matchAll(TAG_RE)) {
    parts.push({ type: 'text', value: template.slice(last, m.index) });
    parts.push({ type: 'var', tag: m[1] });
    last = m.index + m[0].length;
  }
  parts.push({ type: 'text', value: template.slice(last) });

  const slots = parts.filter(p => p.type === 'var');
  const problems = [];
  for (const s of slots) {
    if (s.tag === 'var') problems.push('Untyped {#var#} slot: re-register it with a typed tag.');
    else if (!TAG_RULES[s.tag]) problems.push(`Unknown tag {#${s.tag}#}.`);
  }
  return { parts, slots, problems };
}

// Fill the template. Throws if a value does not fit its tag.
function render(template, values, { allowedHosts = [] } = {}) {
  const { parts, slots, problems } = parseTemplate(template);
  if (problems.length) throw new Error(problems.join(' '));
  if (values.length !== slots.length) {
    throw new Error(`Template has ${slots.length} variables, got ${values.length} values.`);
  }

  let i = 0;
  const errors = [];
  const text = parts.map(p => {
    if (p.type === 'text') return p.value;
    const v = String(values[i++]);
    const rule = TAG_RULES[p.tag];
    if (!rule.pattern.test(v)) errors.push(`Slot ${i} {#${p.tag}#} needs ${rule.desc}, got "${v}".`);
    if (v.length > MAX_VAR_LENGTH) errors.push(`Slot ${i} is ${v.length} characters (limit ${MAX_VAR_LENGTH}).`);
    if ((p.tag === 'url' || p.tag === 'urlott') && allowedHosts.length) {
      try {
        const host = new URL(v).hostname;
        if (!allowedHosts.includes(host)) errors.push(`Slot ${i} host "${host}" is not on your whitelist.`);
      } catch { /* already reported by the pattern check */ }
    }
    return v;
  }).join('');

  if (errors.length) throw new Error(errors.join(' '));
  return text;
}

// Check that an already-built message still matches the template exactly.
// Useful when the message text is assembled somewhere you don't control.
function matches(template, message) {
  const { parts } = parseTemplate(template);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = parts.map(p => (p.type === 'text' ? escape(p.value) : '(.+?)')).join('');
  return new RegExp(`^${source}$`, 's').test(message);
}

// GSM-7 basic set and extension set (extension characters cost two units).
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';

function segments(message) {
  let units = 0;
  let gsm = true;
  for (const ch of message) {
    if (GSM_BASIC.includes(ch)) units += 1;
    else if (GSM_EXT.includes(ch)) units += 2;
    else { gsm = false; break; }
  }
  if (gsm) {
    return { encoding: 'GSM-7', units, segments: units <= 160 ? 1 : Math.ceil(units / 153) };
  }
  // UCS-2: count UTF-16 code units (an emoji uses two).
  const u = message.length;
  return { encoding: 'UCS-2', units: u, segments: u <= 70 ? 1 : Math.ceil(u / 67) };
}

module.exports = { parseTemplate, render, matches, segments, TAG_RULES };
