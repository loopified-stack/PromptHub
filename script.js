
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const clearBtn = document.getElementById('clear');
const statsEl = document.getElementById('stats');

let allPrompts = [];
let filtered = [];

const createCard = (item) => {
  const tpl = document.getElementById('card-tpl').content.cloneNode(true);
  const titleEl = tpl.querySelector('.title');
  const codeEl = tpl.querySelector('pre.prompt code');
  const preEl = tpl.querySelector('pre.prompt');
  const copyBtn = tpl.querySelector('.copy');
  const toggleBtn = tpl.querySelector('.toggle');

  titleEl.textContent = item.title;
  codeEl.textContent = item.prompt;
  preEl.classList.add('collapsed');

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1000);
    } catch (e) {
      // Fallback: select the text manually
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      try { document.execCommand('copy'); } catch {}
      sel.removeAllRanges();
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1000);
    }
  });

  toggleBtn.addEventListener('click', () => {
    if (preEl.classList.contains('collapsed')) {
      preEl.classList.remove('collapsed');
      toggleBtn.textContent = 'Collapse';
    } else {
      preEl.classList.add('collapsed');
      toggleBtn.textContent = 'Expand';
    }
  });

  return tpl;
};

const render = (items) => {
  listEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  items.forEach(p => frag.appendChild(createCard(p)));
  listEl.appendChild(frag);
  statsEl.textContent = `${items.length} prompts ${items.length !== allPrompts.length ? `• filtered from ${allPrompts.length}` : ''}`;
};

const normalize = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '');

const doFilter = () => {
  const q = normalize(searchEl.value);
  if (!q) { filtered = allPrompts.slice(); render(filtered); return; }
  filtered = allPrompts.filter(p => 
    normalize(p.title).includes(q) || normalize(p.prompt).includes(q)
  );
  render(filtered);
};

const init = async () => {
  const res = await fetch('prompts.json');
  allPrompts = await res.json();
  // sort by title
  allPrompts.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  filtered = allPrompts.slice();
  render(filtered);
};

searchEl.addEventListener('input', doFilter);
clearBtn.addEventListener('click', () => { searchEl.value = ''; doFilter(); });

init();
