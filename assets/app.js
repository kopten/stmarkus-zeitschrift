const issues = window.ISSUES || [];
const labels = { de: 'Deutsch', ar: 'العربية', en: 'English' };
const state = { filter: 'all', query: '' };
const $ = (selector) => document.querySelector(selector);
const normal = (value) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function languageClass(language) { return `lang-${language}`; }
function filename(issue) { return `pdf/${encodeURIComponent(issue.file)}`; }
function matches(issue) {
  const haystack = normal([issue.title, issue.year, labels[issue.language], ...issue.articles.map((article) => article.title)].join(' '));
  const filterMatch = state.filter === 'all' || issue.type === state.filter || issue.language === state.filter;
  return filterMatch && haystack.includes(normal(state.query));
}
function card(issue) {
  const articles = issue.articles.length;
  const type = issue.type === 'special' ? 'Sonderheft' : 'Zeitschrift';
  return `<article class="issue ${languageClass(issue.language)}" data-open="${issue.id}">
    <div class="cover" aria-hidden="true"><span class="cover-cross">✣</span><span class="cover-title">St. Markus</span><span class="cover-year">${issue.year}</span><span class="cover-lang">${labels[issue.language]}</span></div>
    <div class="issue-body"><div class="issue-meta"><span>${type}</span><span>${issue.pages || '–'} Seiten</span></div>
    <h3>${issue.title}</h3><p>${articles ? `${articles} Beiträge im Inhaltsverzeichnis` : 'Originalausgabe ansehen'}</p>
    <div class="issue-actions"><button class="text-button" data-open="${issue.id}">${articles ? 'Beiträge lesen' : 'Ausgabe ansehen'} <span>→</span></button><a class="pdf-link" href="${filename(issue)}" target="_blank" rel="noopener">PDF <span>↓</span></a></div></div></article>`;
}
function render() {
  const visible = issues.filter(matches);
  const byYear = visible.reduce((groups, issue) => { (groups[issue.year] ||= []).push(issue); return groups; }, {});
  const chronology = Object.entries(byYear).sort(([firstYear], [secondYear]) => Number(secondYear) - Number(firstYear));
  $('#issues').innerHTML = visible.length ? chronology.map(([year, items]) => `<section class="year-group" aria-label="Ausgaben ${year}"><h3 class="year-heading">${year}</h3><div class="year-issues">${items.map(card).join('')}</div></section>`).join('') : `<div class="empty"><strong>Keine passende Ausgabe gefunden.</strong><p>Versuchen Sie einen anderen Suchbegriff oder Filter.</p></div>`;
  $('#result-count').textContent = `${visible.length} ${visible.length === 1 ? 'Ausgabe' : 'Ausgaben'}`;
}
function openIssue(id) {
  const issue = issues.find((item) => item.id === id);
  if (!issue) return;
  const articleList = issue.articles.length ? `<ol class="articles">${issue.articles.map((article) => `<li><a href="${article.url}"><span>${article.title}</span><b>Lesen →</b></a></li>`).join('')}</ol>` : `<p class="no-articles">Für diese Ausgabe ist noch kein maschinenlesbares Inhaltsverzeichnis verfügbar. Die vollständige Ausgabe steht weiterhin als PDF bereit.</p>`;
  $('#dialog-content').innerHTML = `<p class="eyebrow">${issue.type === 'special' ? 'Sonderheft' : 'St. Markus'} · ${labels[issue.language]}</p><h2>${issue.title}</h2><p class="dialog-subtitle">${issue.pages || '–'} Seiten · ${issue.articles.length} Beiträge</p>${articleList}<a class="button dialog-pdf" href="${filename(issue)}" target="_blank" rel="noopener">PDF-Ausgabe herunterladen ↓</a>`;
  $('#issue-dialog').showModal();
}

$('#search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
$('#filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]'); if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button)); render();
});
$('#issues').addEventListener('click', (event) => {
  if (event.target.closest('.pdf-link')) return;
  const issue = event.target.closest('.issue[data-open]');
  if (issue) openIssue(issue.dataset.open);
});
$('.dialog-close').addEventListener('click', () => $('#issue-dialog').close());
$('#issue-dialog').addEventListener('click', (event) => { if (event.target === $('#issue-dialog')) $('#issue-dialog').close(); });
render();
