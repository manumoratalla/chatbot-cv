// Documentos de data/: lectura y troceado en fragmentos.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Un fragmento por cada sección "## ". El título del documento ("# ") va
// delante de cada fragmento para que se entienda aunque se lea suelto.
export function splitIntoChunks(fileName, markdown) {
  let docTitle = fileName;
  const sections = [];
  let current = null;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('# ')) {
      docTitle = line.slice(2).trim();
    } else if (line.startsWith('## ')) {
      current = { title: line.slice(3).trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  return sections
    .filter((section) => section.lines.join('').trim() !== '')
    .map((section) => {
      const title = `${docTitle} > ${section.title}`;
      return {
        id: `${path.basename(fileName, '.md')}#${slugify(section.title)}`,
        source: fileName,
        title,
        text: `${title}\n${section.lines.join('\n').trim()}`,
      };
    });
}

// Los .md de una carpeta, en orden alfabético: [{ name, content }]
export async function readDocuments(dir) {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.md')).sort();
  return Promise.all(names.map(async (name) => ({
    name,
    content: await readFile(path.join(dir, name), 'utf8'),
  })));
}
