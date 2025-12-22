// =====================
// CONFIG
// =====================
const R2_BASE_URL = "https://pub-69c220e7c10141e18ac15b9cf428ef86.r2.dev";
const WORKER_BASE_URL = "https://gallery-albums.swilliams2.workers.dev";

const ALBUMS_URL = `${WORKER_BASE_URL}/albums`;
const ALBUM_URL = (name) => `${WORKER_BASE_URL}/album?name=${encodeURIComponent(name)}`;

// =====================
// DOM
// =====================
const grid = document.getElementById("grid");
const count = document.getElementById("count");
const shuffleBtn = document.getElementById("shuffleBtn");

const albumsEl = document.getElementById("albums");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const caption = document.getElementById("caption");

const closeBtn = document.getElementById("closeBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// =====================
// STATE
// =====================
let allItems = [];     // raw items for the currently-loaded album
let imageItems = [];   // filtered items we render + navigate
let currentIndex = -1; // index into imageItems
let currentAlbum = null;

// =====================
// HELPERS
// =====================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rebuildImageItems() {
  imageItems = (allItems || []).filter((it) => it && it.type === "image" && it.src);
}

function prettyAlbumName(key) {
  // Pretty display names (folder keys stay clean)
  const map = {
    "pipers-quinceanera": "Piper’s Quinceañera",
    "family": "Family",
    "piper": "Piper",
    "phoebe": "Phoebe"
  };
  return map[key] || key.replace(/[-_]/g, " ");
}

function setActiveAlbumButton(name) {
  if (!albumsEl) return;
  [...albumsEl.querySelectorAll("button")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.album === name);
  });
}

// =====================
// RENDER
// =====================
function render() {
  if (!grid || !count) return;

  grid.innerHTML = "";

  imageItems.forEach((it, idx) => {
    const src = `${R2_BASE_URL}/${it.src}`;

    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.setAttribute("aria-label", it.alt || `Open photo ${idx + 1}`);

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = src;
    img.alt = it.alt || "";

    card.addEventListener("click", () => openLightbox(idx));

    card.appendChild(img);
    grid.appendChild(card);
  });

  const albumLabel = currentAlbum ? ` • ${prettyAlbumName(currentAlbum)}` : "";
  count.textContent = `${imageItems.length} photos${albumLabel}`;
}

// =====================
// LIGHTBOX
// =====================
function openLightbox(idx) {
  if (!lightbox || !lightboxImg) return;
  if (!imageItems.length) return;

  currentIndex = Math.max(0, Math.min(idx, imageItems.length - 1));
  const it = imageItems[currentIndex];

  lightboxImg.src = `${R2_BASE_URL}/${it.src}`;
  lightboxImg.alt = it.alt || "";

  if (caption) {
    const label = it.alt ? it.alt : `Photo ${currentIndex + 1}`;
    caption.textContent = `${label}  •  ${currentIndex + 1} of ${imageItems.length}`;
  }

  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  if (!lightbox || !lightboxImg) return;
  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImg.src = "";
  if (caption) caption.textContent = "";
  currentIndex = -1;
}

function showPrev() {
  if (!imageItems.length) return;
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = (currentIndex - 1 + imageItems.length) % imageItems.length;
  openLightbox(currentIndex);
}

function showNext() {
  if (!imageItems.length) return;
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = (currentIndex + 1) % imageItems.length;
  openLightbox(currentIndex);
}

// Buttons + overlay
closeBtn?.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
prevBtn?.addEventListener("click", (e) => { e.stopPropagation(); showPrev(); });
nextBtn?.addEventListener("click", (e) => { e.stopPropagation(); showNext(); });

lightbox?.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (!lightbox || !lightbox.classList.contains("show")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") showPrev();
  if (e.key === "ArrowRight") showNext();
});

// Swipe support (mobile) - guarded
let touchStartX = null;
if (lightboxImg) {
  lightboxImg.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });

  lightboxImg.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const dx = touchEndX - touchStartX;
    touchStartX = null;

    if (Math.abs(dx) < 40) return;

    if (dx > 0) showPrev();
    else showNext();
  }, { passive: true });
}

// =====================
// WORKER FETCH
// =====================
async function loadAlbums() {
  const res = await fetch(`${ALBUMS_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Albums fetch failed: ${res.status}`);
  const data = await res.json();
  return data.albums || [];
}

async function loadAlbum(name) {
  const res = await fetch(`${ALBUM_URL(name)}&v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Album fetch failed: ${res.status}`);
  return await res.json(); // { title, items }
}

async function init() {
  try {
    if (!count || !grid) return;

    count.textContent = "Loading albums…";

    const albums = await loadAlbums();

    if (!albumsEl) {
      throw new Error("Missing #albums element. Add <div id='albums'></div> in index.html.");
    }

    // Build album buttons
    albumsEl.innerHTML = "";
    albums.forEach((a) => {
      const btn = document.createElement("button");
      btn.className = "album-btn";
      btn.type = "button";
      btn.dataset.album = a;
      btn.textContent = prettyAlbumName(a);

      btn.addEventListener("click", async () => {
        count.textContent = "Loading…";
        const data = await loadAlbum(a);

        currentAlbum = a;
        setActiveAlbumButton(a);

        allItems = data.items || [];
        rebuildImageItems();
        render();
      });

      albumsEl.appendChild(btn);
    });

    // Auto-load default album
    const defaultAlbum = albums.includes("family") ? "family" : albums[0];
    const data = await loadAlbum(defaultAlbum);

    currentAlbum = defaultAlbum;
    setActiveAlbumButton(defaultAlbum);

    allItems = data.items || [];
    rebuildImageItems();
    render();
  } catch (err) {
    console.error("INIT ERROR:", err);
    if (count) count.textContent = "Album system failed to load.";
    if (grid) {
      grid.innerHTML = `<div style="color:rgba(233,238,252,.75);padding:1rem;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(10,14,24,.35);">
        Could not load albums. Check: Worker URL, Worker CORS, and that your index.html contains &lt;div id="albums"&gt;&lt;/div&gt;.
      </div>`;
    }
  }
}

// Shuffle current album
shuffleBtn?.addEventListener("click", () => {
  allItems = shuffle([...allItems]);
  rebuildImageItems();
  render();
});

init();
