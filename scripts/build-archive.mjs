#!/usr/bin/env node
/**
 * Erzeugt die Datenbasis für die statische St.-Markus-Zeitschriftenreihe.
 * Voraussetzung: Poppler (pdftotext, pdfinfo) im PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = readdirSync(root).filter((name) => name.endsWith('.pdf')).sort();

function run(command, args) {
  try { return execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); }
  catch { return ''; }
}

function titleFor(year, issue, special) {
  if (special) return `Sonderheft ${issue} · Anba Michael`;
  return issue ? `St. Markus · Ausgabe ${issue}/${year}` : `St. Markus · ${year}`;
}

function extractArticles(text) {
  const marker = /inhaltsverzeichnis|\bcontents\b|المحتويات/i.exec(text);
  if (!marker) return [];
  // Inhaltsverzeichnisse liegen stets zu Beginn. Der begrenzte Abschnitt vermeidet Fließtext.
  const section = text.slice(marker.index, marker.index + 6000);
  const found = [];
  for (const raw of section.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const match = line.match(/^(.{4,}?)\s+(\d{1,3})(?:\s*\(\d+\))?\s*$/);
    if (!match) continue;
    const title = match[1].replace(/^[–—\-•]+\s*/, '').trim();
    const page = Number(match[2]);
    if (page < 2 || page > 400 || /^(seite|page)$/i.test(title) || title.length > 180) continue;
    if (!found.some((article) => article.title === title && article.page === page)) found.push({ title, page });
  }
  return found.slice(0, 60);
}

function esc(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function articleHtml(issue, article, content, images) {
  const direction = issue.language === 'ar' ? 'rtl' : 'ltr';
  const paragraphs = content.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim()).filter((paragraph) => paragraph.length > 24 && !/^\d+$/.test(paragraph));
  const body = paragraphs.length ? paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('\n') : '<p>Der Text dieser Seite konnte nicht automatisch lesbar aufbereitet werden. Bitte nutzen Sie die Originalausgabe.</p>';
  const gallery = images.length ? `<figure class="article-gallery">${images.map((image) => `<img src="../${image}" alt="Bild aus der Originalausgabe: ${esc(article.title)}" loading="lazy">`).join('')}</figure>` : '';
  return `<!doctype html>
<html lang="${issue.language}" dir="${direction}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(article.title)} - St. Markus ${issue.year}"><title>${esc(article.title)} · St. Markus</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet"><link rel="stylesheet" href="../assets/site.css"><link rel="stylesheet" href="../assets/additions.css"></head>
<body class="article-page"><header class="article-header"><a href="../index.html#ausgaben" class="article-back">← Alle Ausgaben</a><a href="../index.html" class="brand"><span class="brand-mark">✣</span><span>St. Markus</span></a></header><main class="article-main"><p class="eyebrow">${issue.type === 'special' ? 'Sonderheft' : 'St. Markus'} · ${issue.year} · ${labels[issue.language] || issue.language}</p><h1>${esc(article.title)}</h1><p class="article-source">Ausgabe ${issue.number || ''} · Seite ${article.page}</p>${gallery}<div class="article-text">${body}</div><aside class="article-download"><p>Die Gestaltung, Bilder und der vollständige Originalsatz bleiben in der PDF-Ausgabe erhalten.</p><a class="button" href="../${encodeURIComponent(issue.file)}#page=${article.page}" target="_blank" rel="noopener">Originalseite als PDF öffnen ↗</a></aside></main><footer><div><span class="brand-mark">✣</span> St. Markus</div><p>St. Antonius Kloster · Waldsolms-Kröffelbach</p><a href="../index.html#ausgaben">Alle Ausgaben</a></footer></body></html>`;
}

function extractImages(issue, startPage, endPage, index) {
  const directory = resolve(imagesDir, issue.id);
  mkdirSync(directory, { recursive: true });
  const prefix = resolve(directory, String(index + 1).padStart(2, '0'));
  const first = Math.min(Math.max(1, startPage), issue.pages);
  const last = Math.min(Math.max(first, endPage), issue.pages);
  run('pdfimages', ['-f', String(first), '-l', String(last), '-j', issue.file, prefix]);
  const created = readdirSync(directory).filter((name) => name.startsWith(`${String(index + 1).padStart(2, '0')}-`));
  const images = created.filter((name) => /\.(jpe?g|png|webp)$/i.test(name)).map((name) => ({ name, size: statSync(resolve(directory, name)).size })).filter((image) => image.size > 12 * 1024).sort((a, b) => b.size - a.size);
  const keep = images.slice(0, 2);
  created.filter((name) => !keep.some((image) => image.name === name)).forEach((name) => unlinkSync(resolve(directory, name)));
  return keep.map((image) => `assets/article-images/${issue.id}/${image.name}`);
}

const labels = { de: 'Deutsch', ar: 'العربية', en: 'English' };
const articlesDir = resolve(root, 'articles');
const imagesDir = resolve(root, 'assets', 'article-images');
rmSync(articlesDir, { recursive: true, force: true });
rmSync(imagesDir, { recursive: true, force: true });
mkdirSync(articlesDir, { recursive: true });
mkdirSync(imagesDir, { recursive: true });

const issues = files.map((file) => {
  const match = file.match(/^(\d{4})(?:-(\d))?_(.*?)(?:_([A-Za-z]{2}))?\.pdf$/);
  const [, year, number, label, languageCode] = match || [];
  const specialMatch = label?.match(/Anba_Michael_(\d+)_Sonderheft/i);
  const language = (languageCode || (year >= '2021' ? 'de' : 'de')).toLowerCase();
  const pages = Number((run('pdfinfo', [file]).match(/^Pages:\s+(\d+)/m) || [, 0])[1]);
  const text = run('pdftotext', ['-f', '1', '-l', '7', '-layout', file, '-']);
  const articles = extractArticles(text);
  const issue = {
    id: file.replace(/[^a-z0-9]+/gi, '-').replace(/-pdf$/i, '').toLowerCase(),
    file,
    year: Number(year),
    number: specialMatch ? Number(specialMatch[1]) : Number(number || 0),
    type: specialMatch ? 'special' : 'magazine',
    language,
    pages,
    title: titleFor(year, specialMatch ? specialMatch[1] : number, Boolean(specialMatch)),
    articles: []
  };
  const pagesText = run('pdftotext', ['-raw', file, '-']).split('\f');
  if (articles.length) {
    issue.articles = articles.map((article, index) => {
      const next = articles[index + 1]?.page || pages + 1;
      const content = pagesText.slice(Math.max(0, article.page - 1), Math.max(article.page, next - 1)).join('\n\n');
      const slug = `${issue.id}-${String(index + 1).padStart(2, '0')}.html`;
      const images = extractImages(issue, article.page, next - 1, index);
      writeFileSync(resolve(articlesDir, slug), articleHtml(issue, article, content, images));
      return { ...article, url: `articles/${slug}` };
    });
  } else {
    const article = { title: 'Ausgabe online lesen', page: 1 };
    const slug = `${issue.id}-01.html`;
    const images = extractImages(issue, 1, pages, 0);
    writeFileSync(resolve(articlesDir, slug), articleHtml(issue, article, pagesText.join('\n\n'), images));
    issue.articles = [{ ...article, url: `articles/${slug}` }];
  }
  return issue;
}).sort((a, b) => b.year - a.year || b.number - a.number || a.language.localeCompare(b.language));

writeFileSync(resolve(root, 'assets', 'issues.js'), `/* Automatisch erstellt: npm run build */\nwindow.ISSUES = ${JSON.stringify(issues)};\n`);
console.log(`Zeitschriftenreihe erstellt: ${issues.length} Ausgaben, ${issues.reduce((sum, issue) => sum + issue.articles.length, 0)} Artikel.`);
