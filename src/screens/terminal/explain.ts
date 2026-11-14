// `rustc --explain EXXXX`, rendered from the bundled error index (works offline, no toolchain).
// Markdown blocks become terminal lines: prose wraps, code blocks are indented and highlighted.
import { errors, type Block as MdBlock, type Inline } from '../../content';
import type { Line } from './store';

function inl(xs: Inline[]): string {
  return xs.map((x) => {
    switch (x.k) {
      case 't': return x.v.replace(/§/g, '');
      case 'code': return '§c' + x.v.replace(/§/g, '') + '§n';
      case 'em': return inl(x.c);
      case 'strong': return '§W' + inl(x.c) + '§n';
      case 'link': return inl(x.c);
    }
  }).join('');
}

function blocks(bs: MdBlock[], out: Line[], indent = '') {
  bs.forEach((b) => {
    if (out.length) out.push('');
    switch (b.type) {
      case 'h2': case 'h3': case 'h4':
        out.push({ w: indent + '§W' + inl(b.text) + '§n' });
        break;
      case 'p':
        out.push({ w: indent + inl(b.text) });
        break;
      case 'ul': case 'ol': {
        const start = (b as { start?: number }).start ?? 1;
        b.items.forEach((it, i) => out.push({ w: indent + (b.type === 'ol' ? `${start + i}. ` : '- ') + inl(it) }));
        break;
      }
      case 'code': {
        const lang = b.lang === 'rust' || b.lang === '' ? 'rust' : b.lang === 'toml' ? 'toml' : null;
        b.code.split('\n').forEach((ln) => out.push(lang ? { code: ln, lang, pre: indent + '    ' } : indent + '    ' + ln.replace(/§/g, '')));
        break;
      }
      case 'note': case 'quote':
        blocks(b.blocks, out, indent + '  ');
        break;
      case 'table':
        b.rows.forEach((r) => out.push({ w: indent + r.map(inl).join('  ') }));
        break;
      case 'hr':
        out.push('§d---');
        break;
      default:
        break;
    }
  });
}

/** Normalizes "0382" / "E0382" like rustc. Returns null for an unknown code. */
export function errorCode(arg: string): string | null {
  let c = arg.trim();
  if (/^\d{1,4}$/.test(c)) c = 'E' + c.padStart(4, '0');
  return errors[c] ? c : null;
}

export function explainLines(code: string): Line[] {
  const e = errors[code];
  if (!e) return [];
  const out: Line[] = [];
  blocks(e.blocks, out);
  return out;
}
