// GLOBAL STATE
let prompts = [];
let state = {
  category: "All",
  search: "",
  sort: "newest"
};

// DOM REFS
const categoriesEl = document.getElementById("categories");
const gridEl = document.getElementById("promptGrid");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");

// LOAD DATA
async function loadPrompts() {
  const res = await fetch("prompts.json");
  prompts = await res.json();
  renderCategories();
  renderGrid();
}

// BUILD CATEGORY CHIPS
function renderCategories() {
  const cats = ["All", ...new Set(prompts.map(p => p.category))];
  categoriesEl.innerHTML = "";

  cats.forEach(cat => {
    const chip = document.createElement("button");
    chip.className = "chip" + (state.category === cat ? " active" : "");
    chip.textContent = cat === "All" ? "🔥 All" : cat;
    chip.addEventListener("click", () => {
      state.category = cat;
      renderCategories();
      renderGrid();
    });

    categoriesEl.appendChild(chip);
  });
}

// SORTING LOGIC
function sortList(list) {
  if (state.sort === "az") return list.sort((a,b)=>a.title.localeCompare(b.title));
  if (state.sort === "za") return list.sort((a,b)=>b.title.localeCompare(a.title));
  return list.sort((a,b)=> (b.created_at || "").localeCompare(a.created_at || ""));
}

// FILTERING LOGIC
function filterList() {
  let list = [...prompts];

  if (state.category !== "All") {
    list = list.filter(p => p.category === state.category);
  }

  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    list = list.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.model || "").toLowerCase().includes(q) ||
      (p.use_case || "").toLowerCase().includes(q) ||
      (p.body || "").toLowerCase().includes(q) ||
      (p.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }

  return sortList(list);
}

// RENDER GRID
function renderGrid() {
  const list = filterList();
  gridEl.innerHTML = "";

  list.forEach(p => {
    const card = document.createElement("article");
    card.className = "card";

    // HEADER
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">${p.title}</div>
        <div class="card-category">${p.emoji || ""} ${p.category}</div>
      </div>
      <div class="meta-row">
        <span class="meta-pill">Model: ${p.model}</span>
        <span class="meta-pill">Use case: ${p.use_case}</span>
      </div>
      <div class="card-desc">${p.description || ""}</div>
      <div class="tags">${(p.tags || []).map(t=>`<span class="tag">#${t}</span>`).join("")}</div>
      ${p.source && p.source.label ? 
        `<div class="source">From: <a href="${p.source.url}" target="_blank">${p.source.label}</a></div>` 
        : ""}
      <div class="card-actions">
        <button class="toggle">Show prompt</button>
        <button class="copy primary">Copy</button>
      </div>
      <pre class="prompt-body">${p.body}</pre>
    `;

    // Toggle body
    card.querySelector(".toggle").addEventListener("click", (e)=>{
      const body = card.querySelector(".prompt-body");
      const open = body.classList.toggle("open");
      e.target.textContent = open ? "Hide prompt" : "Show prompt";
    });

    // Copy
    card.querySelector(".copy").addEventListener("click", async (e)=>{
      await navigator.clipboard.writeText(p.body);
      const old = e.target.textContent;
      e.target.textContent = "Copied!";
      setTimeout(()=> e.target.textContent = old, 1200);
    });

    gridEl.appendChild(card);
  });
}

// SEARCH + SORT EVENTS
searchEl.addEventListener("input", () => {
  state.search = searchEl.value;
  renderGrid();
});
sortEl.addEventListener("change", () => {
  state.sort = sortEl.value;
  renderGrid();
});

// START
loadPrompts();

