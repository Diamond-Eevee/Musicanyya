import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { XmlElement } from '@rgrove/parse-xml';
import { readXml } from '../../src/core/musicxml/read.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { handleMessage } from '../../src/workers/verovio.worker.js';

let requestCounter = 0;

async function initVerovio(): Promise<void> {
  return new Promise((resolve, reject) => {
    handleMessage({ data: { type: 'init', requestId: ++requestCounter } } as any, (msg: any) => {
      if (msg.type === 'ready') resolve();
      else if (msg.type === 'error') reject(new Error(`Verovio error: ${msg.message}`));
    });
  });
}

async function renderSvg(renderXml: string): Promise<string> {
  let laidOut = false;
  let pageCount = 0;
  await new Promise<void>((resolve, reject) => {
    handleMessage(
      {
        data: {
          type: 'load',
          requestId: ++requestCounter,
          renderXml,
          options: { pageWidth: 2000, pageHeight: 2000, scale: 100, header: 'none' },
        },
      } as any,
      (msg: any) => {
        if (msg.type === 'laidOut') {
          laidOut = true;
          pageCount = msg.pageCount;
          resolve();
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        }
      },
    );
  });

  let fullSvg = '';
  for (let i = 1; i <= pageCount; i++) {
    await new Promise<void>((resolve) => {
      handleMessage({ data: { type: 'page', requestId: ++requestCounter, page: i } } as any, (msg: any) => {
        if (msg.type === 'svg') fullSvg += msg.svg;
        resolve();
      });
    });
  }
  return fullSvg;
}

function findMusicXmlFiles(dir: string, base: string = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findMusicXmlFiles(full, base));
    } else if (/\.musicxml$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out.sort();
}

function countXmlTags(node: XmlElement, tagNames: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of tagNames) counts[t] = 0;

  function traverse(n: any) {
    if (n instanceof XmlElement) {
      // @ts-ignore
      if (counts[n.name] !== undefined) counts[n.name]++;
      for (const child of n.children) traverse(child);
    }
  }
  traverse(node);
  return counts;
}

async function auditLibrary(libraryRoot: string) {
  await initVerovio();
  const files = findMusicXmlFiles(path.join(libraryRoot, 'repertoire'), libraryRoot);

  const tagsToCount = [
    'beam',
    'accidental',
    'stem',
    'rest',
    'tie',
    'slur',
    'dynamics',
    'wedge',
    'words',
    'metronome',
    'articulations',
    'fingering',
    'pedal',
    'ornaments',
    'repeat',
    'ending',
    'movement-title',
    'work-title',
    'creator',
    'print',
  ];

  for (const relFile of files) {
    const filePath = path.join(libraryRoot, relFile);
    const xml = decodeXml(fs.readFileSync(filePath));
    const { doc } = readXml(xml);
    const root = doc.children.find((c) => c instanceof XmlElement) as XmlElement;
    const xmlCounts = countXmlTags(root, tagsToCount);

    const svg = await renderSvg(xml);

    const svgCounts = {
      beam: (svg.match(/class="beam"/g) || []).length,
      accid: (svg.match(/class="accid"/g) || []).length,
      stem: (svg.match(/class="stem"/g) || []).length,
      rest: (svg.match(/class="rest"/g) || []).length,
      tie: (svg.match(/class="tie"/g) || []).length,
      slur: (svg.match(/class="slur"/g) || []).length,
      dynam: (svg.match(/class="dynam"/g) || []).length,
      hairpin: (svg.match(/class="hairpin"/g) || []).length,
      dir: (svg.match(/class="dir"/g) || []).length,
      tempo: (svg.match(/class="tempo"/g) || []).length,
      artic: (svg.match(/class="artic"/g) || []).length,
      fingering: (svg.match(/class="fingering"/g) || []).length,
      pedal: (svg.match(/class="pedal"/g) || []).length,
      ornam: (svg.match(/class="ornam"/g) || []).length,
      repeat: (svg.match(/class="repeat"/g) || []).length,
      ending: (svg.match(/class="ending"/g) || []).length,
      measureText: (svg.match(/class="measure"[^>]*>[\s\S]*?<text/g) || []).length,
    };

    console.log(`\n=== ${relFile} ===`);
    console.log(
      `XML tags: ` +
        Object.entries(xmlCounts)
          .filter(([_, c]) => c > 0)
          .map(([k, c]) => `${k}:${c}`)
          .join(', '),
    );
    console.log(
      `SVG clss: ` +
        Object.entries(svgCounts)
          .filter(([_, c]) => c > 0)
          .map(([k, c]) => `${k}:${c}`)
          .join(', '),
    );
  }
}

async function main() {
  const libraryRoot = fileURLToPath(new URL('../../public/library/', import.meta.url));
  await auditLibrary(libraryRoot);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
