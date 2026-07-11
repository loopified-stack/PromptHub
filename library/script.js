// ------------------------------
// GLOBAL STATE
// ------------------------------

let prompts = [];

const promptBodyCache = new Map();

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
// PROMPT BODY LOADING
// ------------------------------

async function loadPromptBody(prompt) {
  const cacheKey =
    prompt.id ||
    prompt.body_file ||
    prompt.title;

  if (promptBodyCache.has(cacheKey)) {
    return promptBodyCache.get(cacheKey);
  }

  let body = "";

  // New structure:
  // Load the prompt from a separate Markdown file.
  if (prompt.body_file) {
    try {
      const response = await fetch(`./${prompt.body_file}`);

      if (!response.ok) {
        throw new Error(
          `Could not load prompt file: ${prompt.body_file}`
        );
      }

      body = await response.text();

    } catch (error) {
      console.error(error);

      // Safe fallback during migration:
      // Use the old JSON body when available.
      if (prompt.body) {
        body = prompt.body;
      } else {
        throw error;
      }
    }

  // Old structure:
  // Read the prompt directly from prompts.json.
  } else {
    body = prompt.body || "";
  }

  promptBodyCache.set(cacheKey, body);

  return body;
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
    const response = await fetch("./prompts.json");

    if (!response.ok) {
      throw new Error("Could not load prompts.json");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        "prompts.json must contain a JSON array."
      );
    }

    prompts = data;

    promptBodyCache.clear();

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
  const categories = uniqueArray(
    prompts.map(prompt => prompt.category)
  );

  const featured = prompts.filter(
    prompt => prompt.featured
  ).length;

  if (statTotalEl) {
    statTotalEl.textContent = prompts.length;
  }

  if (statCategoriesEl) {
    statCategoriesEl.textContent = categories.length;
  }

  if (statFeaturedEl) {
    statFeaturedEl.textContent = featured;
  }
}

// ------------------------------
// CATEGORIES
// ------------------------------

function renderCategories() {
  const categories = [
    "All",
    ...uniqueArray(
      prompts.map(prompt => prompt.category)
    ).sort()
  ];

  categoriesEl.innerHTML = "";

  categories.forEach(category => {
    const chip = document.createElement("button");

    chip.className =
      "chip" +
      (state.category === category ? " active" : "");

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
    (b.created_at || "").localeCompare(
      a.created_at || ""
    )
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
      prompt => prompt.category === state.category
    );
  }

  // FEATURED

  if (state.featured) {
    list = list.filter(
      prompt => prompt.featured === true
    );
  }

  // SEARCH

  if (state.search.trim()) {
    const query = normalize(state.search);

    list = list.filter(prompt => {
      const searchable = [
        prompt.title,
        prompt.category,
        prompt.model,
        prompt.use_case,
        prompt.description,

        // Inline bodies remain searchable.
        prompt.body,

        // External file names are searchable.
        // The complete Markdown content is not loaded
        // during normal search.
        prompt.body_file,

        prompt.pattern,
        prompt.difficulty,

        ...(prompt.tags || []),
        ...(prompt.output_type || []),
        ...(prompt.best_for || []),
        ...(prompt.why_it_works || []),
        ...(prompt.chainable_with || [])
      ]
        .map(normalize)
        .join(" ");

      return searchable.includes(query);
    });
  }

  return sortList(list);
}

// ------------------------------
// CARD TEMPLATE
// ------------------------------

function createCard(prompt) {
  const card = document.createElement("article");

  card.className = "card";

  const tags = (prompt.tags || [])
    .slice(0, 8)
    .map(tag =>
      `<span class="tag">#${escapeHTML(tag)}</span>`
    )
    .join("");

  const outputTypes = (prompt.output_type || [])
    .map(type =>
      `<span class="meta-pill">${escapeHTML(type)}</span>`
    )
    .join("");

  const bestFor = (prompt.best_for || [])
    .slice(0, 3)
    .map(item =>
      `<span class="tag">${escapeHTML(item)}</span>`
    )
    .join("");

  const whyItWorks = (prompt.why_it_works || [])
    .slice(0, 3)
    .map(item =>
      `<li>${escapeHTML(item)}</li>`
    )
    .join("");

  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">
          ${escapeHTML(prompt.title)}
        </div>

        ${
          prompt.featured
            ? `<div class="featured-badge">Featured</div>`
            : ""
        }
      </div>

      <div class="card-category">
        ${escapeHTML(prompt.emoji || "")}
        ${escapeHTML(prompt.category || "General")}
      </div>
    </div>

    <div class="meta-row">
      ${
        prompt.model
          ? `
            <span class="meta-pill">
              Model: ${escapeHTML(prompt.model)}
            </span>
          `
          : ""
      }

      ${
        prompt.difficulty
          ? `
            <span class="meta-pill">
              Level: ${escapeHTML(prompt.difficulty)}
            </span>
          `
          : ""
      }

      ${
        prompt.pattern
          ? `
            <span class="meta-pill">
              Pattern: ${escapeHTML(prompt.pattern)}
            </span>
          `
          : ""
      }
    </div>

    ${
      outputTypes
        ? `<div class="meta-row">${outputTypes}</div>`
        : ""
    }

    <div class="card-desc">
      ${escapeHTML(prompt.description || "")}
    </div>

    ${
      prompt.use_case
        ? `
          <div class="info-block">
            <strong>Use case</strong>
            <span>${escapeHTML(prompt.use_case)}</span>
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
      prompt.source && prompt.source.label
        ? `
          <div class="source">
            From:
            <a
              href="${escapeHTML(prompt.source.url)}"
              target="_blank"
              rel="noopener"
            >
              ${escapeHTML(prompt.source.label)}
            </a>
          </div>
        `
        : ""
    }

    <div class="card-actions">
      <button class="toggle">
        Show prompt
      </button>

      <button class="copy primary">
        Copy
      </button>
    </div>

    <pre
      class="prompt-body"
      aria-live="polite"
    ></pre>
  `;

  const toggleButton =
    card.querySelector(".toggle");

  const copyButton =
    card.querySelector(".copy");

  const promptBody =
    card.querySelector(".prompt-body");

  // ------------------------------
  // SHOW / HIDE PROMPT
  // ------------------------------

  toggleButton.addEventListener(
    "click",
    async () => {
      const isOpen =
        promptBody.classList.contains("open");

      // Close the prompt when already open.
      if (isOpen) {
        promptBody.classList.remove("open");
        toggleButton.textContent = "Show prompt";
        return;
      }

      promptBody.classList.add("open");
      promptBody.textContent = "Loading prompt...";

      toggleButton.disabled = true;
      toggleButton.textContent = "Loading...";

      try {
        const body = await loadPromptBody(prompt);

        promptBody.textContent =
          body || "No prompt content available.";

        toggleButton.textContent = "Hide prompt";

      } catch (error) {
        console.error(error);

        promptBody.textContent =
          "The prompt could not be loaded. " +
          "Please check the body_file path.";

        toggleButton.textContent = "Hide prompt";

      } finally {
        toggleButton.disabled = false;
      }
    }
  );

  // ------------------------------
  // COPY PROMPT
  // ------------------------------

  copyButton.addEventListener(
    "click",
    async () => {
      const originalText =
        copyButton.textContent;

      copyButton.disabled = true;
      copyButton.textContent = "Loading...";

      try {
        const body = await loadPromptBody(prompt);

        if (!body.trim()) {
          throw new Error(
            "The prompt body is empty."
          );
        }

        await navigator.clipboard.writeText(body);

        copyButton.textContent = "Copied!";
        copyButton.classList.add("copied");

      } catch (error) {
        console.error(error);

        copyButton.textContent = "Copy failed";

      } finally {
        setTimeout(() => {
          copyButton.textContent = originalText;
          copyButton.classList.remove("copied");
          copyButton.disabled = false;
        }, 1200);
      }
    }
  );

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
      `${list.length} prompt${
        list.length === 1 ? "" : "s"
      } found`;
  }

  if (emptyStateEl) {
    emptyStateEl.classList.toggle(
      "show",
      list.length === 0
    );
  }

  list.forEach(prompt => {
    gridEl.appendChild(
      createCard(prompt)
    );
  });
}

// ------------------------------
// EVENTS
// ------------------------------

if (searchEl) {
  searchEl.addEventListener("input", () => {
    state.search = searchEl.value;

    renderGrid();
  });
}

if (sortEl) {
  sortEl.addEventListener("change", () => {
    state.sort = sortEl.value;

    renderGrid();
  });
}

// ------------------------------
// START
// ------------------------------

applyURLParams();
loadPrompts();
