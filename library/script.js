// ------------------------------
// GLOBAL STATE
// ------------------------------

let prompts = [];

let state = {
  category: "All",
  search: "",
  sort: "newest",
  featured: false
};

// ------------------------------
// DOM REFS
// ------------------------------

const categoriesEl = document.getElementById("categories");
const gridEl = document.getElementById("promptGrid");

const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");

const statTotalEl = document.getElementById("statTotal");
const statCategoriesEl = document.getElementById("statCategories");
const statFeaturedEl = document.getElementById("statFeatured");

const resultCountEl = document.getElementById("resultCount");
const emptyStateEl = document.getElementById("emptyState");

// ------------------------------
// HELPERS
// ------------------------------

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value = "") {
  return String(value).toLowerCase().trim();
}

function uniqueArray(array) {
  return [...new Set(array.filter(Boolean))];
}

// ------------------------------
// URL PARAMS
// ------------------------------

function applyURLParams() {
  const params = new URLSearchParams(window.location.search);

  const category = params.get("category");
  const featured = params.get("featured");
  const sort = params.get("sort");
  const tag = params.get("tag");

  if (category) state.category = category;
  if (featured === "true") state.featured = true;
  if (sort) state.sort = sort;
  if (tag) state.search = tag;

  if (searchEl && tag) {
    searchEl.value = tag;
  }

  if (sortEl && sort) {
    sortEl.value = sort;
  }
}

// ------------------------------
// LOAD DATA
// ------------------------------

async function loadPrompts() {
  try {
    const res = await fetch("./prompts.json");

    if (!res.ok) {
      throw new Error("Could not load prompts.json");
    }

    prompts = await res.json();

    renderStats();
    renderCategories();
    renderGrid();

  } catch (error) {

    console.error(error);

    gridEl.innerHTML = `
      <div class="empty-state show">
        <div class="empty-icon">⚠️</div>
        <h3>Prompt library could not be loaded</h3>
        <p>Please check your prompts.json file.</p>
      </div>
    `;
  }
}

// ------------------------------
// STATS
// ------------------------------

function renderStats() {
  const categories = uniqueArray(prompts.map(p => p.category));
  const featured = prompts.filter(p => p.featured).length;

  if (statTotalEl) statTotalEl.textContent = prompts.length;
  if (statCategoriesEl) statCategoriesEl.textContent = categories.length;
  if (statFeaturedEl) statFeaturedEl.textContent = featured;
}

// ------------------------------
// CATEGORIES
// ------------------------------

function renderCategories() {

  const categories = [
    "All",
    ...uniqueArray(prompts.map(p => p.category)).sort()
  ];

  categoriesEl.innerHTML = "";

  categories.forEach(category => {

    const chip = document.createElement("button");

    chip.className =
      "chip" + (state.category === category ? " active" : "");

    chip.textContent =
      category === "All"
        ? "🔥 All Prompts"
        : category;

    chip.addEventListener("click", () => {
      state.category = category;

      renderCategories();
      renderGrid();
    });

    categoriesEl.appendChild(chip);
  });
}

// ------------------------------
// SORTING
// ------------------------------

function sortList(list) {

  const sorted = [...list];

  if (state.sort === "az") {
    return sorted.sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  if (state.sort === "za") {
    return sorted.sort((a, b) =>
      b.title.localeCompare(a.title)
    );
  }

  return sorted.sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || "")
  );
}

// ------------------------------
// FILTERING
// ------------------------------

function filterList() {

  let list = [...prompts];

  // CATEGORY

  if (state.category !== "All") {
    list = list.filter(
      p => p.category === state.category
    );
  }

  // FEATURED

  if (state.featured) {
    list = list.filter(
      p => p.featured === true
    );
  }

  // SEARCH

  if (state.search.trim()) {

    const q = normalize(state.search);

    list = list.filter(p => {

      const searchable = [

        p.title,
        p.category,
        p.model,
        p.use_case,
        p.description,
        p.body,
        p.pattern,
        p.difficulty,

        ...(p.tags || []),
        ...(p.output_type || []),
        ...(p.best_for || []),
        ...(p.why_it_works || []),
        ...(p.chainable_with || [])

      ]
        .map(normalize)
        .join(" ");

      return searchable.includes(q);
    });
  }

  return sortList(list);
}

// ------------------------------
// CARD TEMPLATE
// ------------------------------

function createCard(p) {

  const card = document.createElement("article");
  card.className = "card";

  const tags = (p.tags || [])
    .slice(0, 8)
    .map(tag =>
      `<span class="tag">#${escapeHTML(tag)}</span>`
    )
    .join("");

  const outputTypes = (p.output_type || [])
    .map(type =>
      `<span class="meta-pill">${escapeHTML(type)}</span>`
    )
    .join("");

  const bestFor = (p.best_for || [])
    .slice(0, 3)
    .map(item =>
      `<span class="tag">${escapeHTML(item)}</span>`
    )
    .join("");

  const whyItWorks = (p.why_it_works || [])
    .slice(0, 3)
    .map(item =>
      `<li>${escapeHTML(item)}</li>`
    )
    .join("");

  card.innerHTML = `

    <div class="card-header">

      <div>
        <div class="card-title">
          ${escapeHTML(p.title)}
        </div>

        ${
          p.featured
            ? `<div class="featured-badge">Featured</div>`
            : ""
        }
      </div>

      <div class="card-category">
        ${escapeHTML(p.emoji || "")}
        ${escapeHTML(p.category || "General")}
      </div>

    </div>

    <div class="meta-row">

      ${
        p.model
          ? `<span class="meta-pill">Model: ${escapeHTML(p.model)}</span>`
          : ""
      }

      ${
        p.difficulty
          ? `<span class="meta-pill">Level: ${escapeHTML(p.difficulty)}</span>`
          : ""
      }

      ${
        p.pattern
          ? `<span class="meta-pill">Pattern: ${escapeHTML(p.pattern)}</span>`
          : ""
      }

    </div>

    ${
      outputTypes
        ? `<div class="meta-row">${outputTypes}</div>`
        : ""
    }

    <div class="card-desc">
      ${escapeHTML(p.description || "")}
    </div>

    ${
      p.use_case
        ? `
        <div class="info-block">
          <strong>Use case</strong>
          <span>${escapeHTML(p.use_case)}</span>
        </div>
      `
        : ""
    }

    ${
      whyItWorks
        ? `
        <div class="why-block">
          <strong>Why it works</strong>
          <ul>${whyItWorks}</ul>
        </div>
      `
        : ""
    }

    ${
      bestFor
        ? `<div class="tags best-for">${bestFor}</div>`
        : ""
    }

    <div class="tags">
      ${tags}
    </div>

    ${
      p.source && p.source.label
        ? `
        <div class="source">
          From:
          <a href="${escapeHTML(p.source.url)}" target="_blank" rel="noopener">
            ${escapeHTML(p.source.label)}
          </a>
        </div>
      `
        : ""
    }

    <div class="card-actions">
      <button class="toggle">Show prompt</button>
      <button class="copy primary">Copy</button>
    </div>

    <pre class="prompt-body">${escapeHTML(p.body || "")}</pre>
  `;

  // TOGGLE

  const toggleBtn = card.querySelector(".toggle");
  const copyBtn = card.querySelector(".copy");
  const promptBody = card.querySelector(".prompt-body");

  toggleBtn.addEventListener("click", () => {

    const isOpen =
      promptBody.classList.toggle("open");

    toggleBtn.textContent =
      isOpen
        ? "Hide prompt"
        : "Show prompt";
  });

  // COPY

  copyBtn.addEventListener("click", async () => {

    try {

      await navigator.clipboard.writeText(
        p.body || ""
      );

      const oldText = copyBtn.textContent;

      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");

      setTimeout(() => {
        copyBtn.textContent = oldText;
        copyBtn.classList.remove("copied");
      }, 1200);

    } catch {

      copyBtn.textContent = "Copy failed";

      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    }
  });

  return card;
}

// ------------------------------
// RENDER GRID
// ------------------------------

function renderGrid() {

  const list = filterList();

  gridEl.innerHTML = "";

  if (resultCountEl) {

    resultCountEl.textContent =
      `${list.length} prompt${list.length === 1 ? "" : "s"} found`;
  }

  if (emptyStateEl) {

    emptyStateEl.classList.toggle(
      "show",
      list.length === 0
    );
  }

  list.forEach(prompt => {
    gridEl.appendChild(createCard(prompt));
  });
}

// ------------------------------
// EVENTS
// ------------------------------

searchEl.addEventListener("input", () => {

  state.search = searchEl.value;

  renderGrid();
});

sortEl.addEventListener("change", () => {

  state.sort = sortEl.value;

  renderGrid();
});

// ------------------------------
// START
// ------------------------------

applyURLParams();
loadPrompts();
