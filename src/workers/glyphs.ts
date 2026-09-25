import type { VerovioToolkit } from 'verovio';

/**
 * The music-font glyphs the red discs need, read out of Verovio itself (feature 008, research R-11): the accidentals
 * are drawn with the very Leipzig shapes of the engraved page, so no font file is bundled and Constitution III holds.
 * Path data is in font units, y up (SVG `<path d>`); `unitsPerEm` is the font's em, four staff spaces.
 */
export interface HarvestedGlyphs {
  sharp: string;
  flat: string;
  natural: string;
  notehead: string;
  unitsPerEm: number;
}

/** One measure with a sharp, a flat, a natural and plain black noteheads: everything the harvest needs to see drawn. */
const SNIPPET = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
  <meiHead><fileDesc><titleStmt><title/></titleStmt><pubStmt/></fileDesc></meiHead>
  <music><body><mdiv><score>
    <scoreDef><staffGrp><staffDef n="1" lines="5" clef.shape="G" clef.line="2"/></staffGrp></scoreDef>
    <section><measure n="1"><staff n="1"><layer n="1">
      <note pname="f" oct="4" dur="4" accid="s"/>
      <note pname="b" oct="4" dur="4" accid="f"/>
      <note pname="c" oct="5" dur="4" accid="n"/>
      <note pname="d" oct="5" dur="4"/>
    </layer></staff></measure></section>
  </score></mdiv></body></music>
</mei>`;

/** SMuFL code points: accidental sharp, flat, natural and the black notehead. */
const GLYPH_IDS = { sharp: 'E262', flat: 'E260', natural: 'E261', notehead: 'E0A4' } as const;

/** The path data of one glyph from the SVG's `<defs>`: `<g id="E262-suffix"><path d="..."/></g>`. */
function pathOf(svg: string, codePoint: string): string {
  const match = new RegExp(`<g id="${codePoint}-[^"]*"[^>]*>\\s*<path[^>]*?\\sd="([^"]+)"`).exec(svg);
  if (!match?.[1]) throw new Error(`glyph ${codePoint} not found in the Verovio SVG`);
  return match[1];
}

/**
 * Renders the built-in snippet on a toolkit with no Score loaded and returns the glyph path data. The font's units per
 * em come from the same picture: the glyphs are placed with `scale(k, k)` and a staff space is the distance between two
 * staff lines, so a staff space is `spacing / k` font units and an em is four of them. Throws when the picture is not
 * what it expects (the caller then draws no accidentals rather than a wrong one). Sets only options that every
 * `load` sets again, so a Score loaded afterwards renders as it would have without this call.
 */
export function harvestGlyphs(toolkit: VerovioToolkit): HarvestedGlyphs {
  toolkit.setOptions({
    pageWidth: 600,
    pageHeight: 400,
    scale: 100,
    font: 'Leipzig',
    svgViewBox: 1,
    header: 'none',
    footer: 'none',
  });
  toolkit.loadData(SNIPPET);
  const svg = toolkit.renderToSVG(1);

  const scale = /<use [^>]*transform="[^"]*scale\(([\d.]+)/.exec(svg)?.[1];
  const lines = [...svg.matchAll(/<path d="M-?[\d.]+ ([\d.]+) L-?[\d.]+ \1"/g)].map((m) => Number(m[1]));
  const spacing = (lines[1] ?? Number.NaN) - (lines[0] ?? Number.NaN);
  const k = Number(scale);
  if (!(k > 0) || !(spacing > 0)) throw new Error('cannot read the glyph scale from the Verovio SVG');

  return {
    sharp: pathOf(svg, GLYPH_IDS.sharp),
    flat: pathOf(svg, GLYPH_IDS.flat),
    natural: pathOf(svg, GLYPH_IDS.natural),
    notehead: pathOf(svg, GLYPH_IDS.notehead),
    unitsPerEm: Math.round((4 * spacing) / k),
  };
}
