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
const lightboxVideo = document.getElementById("lightboxVideo");
const caption = document.getElementById("caption");

const closeBtn = document.getElementById("closeBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// =====================
// STATE
// =====================
let allItems = [];      // all items for current album
let mediaItems = [];    // filtered items (images + videos)
let currentIndex = -1;  // index into mediaItems
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

function isVideoItem(it) {
  return it && it.type === "video";
}

function rebuildMediaItems() {
  mediaItems = (allItems || []).filter(
    (it) => it && (it.type === "image" || it.type === "video") && it.src
  );
}

function prettyAlbumName(key) {
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
// RENDER GRID
// =====================
function render() {
  if (!grid || !count) return;

  grid.innerHTML = "";

  mediaItems.forEach((it, idx) => {
    const src = `${R2_BASE_URL}/${it.src}`;

    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.setAttribute("aria-label", it.alt || `Open item ${idx + 1}`);

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = src;
    img.alt = it.alt || "";

    // If it's a video, add a play badge overlay
    if (isVideoItem(it)) {
      card.classList.add("is-video");

      const badge = document.createElement("div");
      badge.className = "play-badge";
      badge.innerHTML = `<span class="play-triangle"></span>`;
      card.appendChild(badge);

      // For videos, some browsers won't show anything unless we use a poster.
      // We'll still set img.src to the video URL; the tile may appear blank in some cases.
      // If you want true video thumbnails later, we can generate posters.
      img.src = src;
    }

    card.addEventListener("click", () => openLightbox(idx));

    card.appendChild(img);
    grid.appendChild(card);
  });

  const albumLabel = currentAlbum ? ` • ${prettyAlbumName(currentAlbum)}` : "";
  count.textContent = `${mediaItems.length} items${albumLabel}`;
}

// =====================
// LIGHTBOX
// =====================
function openLightbox(idx) {
  if (!lightbox) return;
  if (!mediaItems.length) return;

  currentIndex = Math.max(0, Math.min(idx, mediaItems.length - 1));
  const it = mediaItems[currentIndex];
  const url = `${R2_BASE_URL}/${it.src}`;

  // reset viewers
  if (lightboxImg) {
    lightboxImg.classList.remove("hide-img");
    lightboxImg.src = "";
    lightboxImg.alt = "";
  }
  if (lightboxVideo) {
    lightboxVideo.classList.remove("show-video");
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.load();
  }

  // show correct viewer
  if (isVideoItem(it)) {
    if (lightboxVideo) {
      lightboxVideo.src = url;
      lightboxVideo.classList.add("show-video");
      // no autoplay by default (safer + less annoying)
    }
    if (lightboxImg) lightboxImg.classList.add("hide-img");
  } else {
    if (lightboxImg) {
      lightboxImg.src = url;
      lightboxImg.alt = it.alt || "";
    }
  }

  if (caption) {
    const label = it.alt ? it.alt : `Item ${currentIndex + 1}`;
    const kind = isVideoItem(it) ? "Video" : "Photo";
    caption.textContent = `${kind}: ${label}  •  ${currentIndex + 1} of ${mediaItems.length}`;
  }

  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  if (!lightbox) return;

  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden", "true");

  if (lightboxImg) {
    lightboxImg.src = "";
    lightboxImg.alt = "";
    lightboxImg.classList.remove("hide-img");
  }

  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.classList.remove("show-video");
    lightboxVideo.load();
  }

  if (caption) caption.textContent = "";
  currentIndex = -1;
}

function showPrev() {
  if (!mediaItems.length) return;
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = (currentIndex - 1 + mediaItems.length) % mediaItems.length;
  openLightbox(currentIndex);
}

function showNext() {
  if (!mediaItems.length) return;
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = (currentIndex + 1) % mediaItems.length;
  openLightbox(currentIndex);
}

// Buttons + overlay close
closeBtn?.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
prevBtn?.addEventListener("click", (e) => { e.stopPropagation(); showPrev(); });
nextBtn?.addEventListener("click", (e) => { e.stopPropagation(); showNext(); });

lightbox?.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

// Keyboard nav
document.addEventListener("keydown", (e) => {
  if (!lightbox || !lightbox.classList.contains("show")) return;

  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") showPrev();
  if (e.key === "ArrowRight") showNext();
});

// Swipe support (mobile) - works on both image and video areas
let touchStartX = null;

function attachSwipe(el) {
  if (!el) return;

  el.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });

  el.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const dx = touchEndX - touchStartX;
    touchStartX = null;

    if (Math.abs(dx) < 40) return;

    if (dx > 0) showPrev();
    else showNext();
  }, { passive: true });
}

attachSwipe(lightboxImg);
attachSwipe(lightboxVideo);

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

// =====================
// INIT
// =====================
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
        rebuildMediaItems();
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
    rebuildMediaItems();
    render();
  } catch (err) {
    console.error("INIT ERROR:", err);
    if (count) count.textContent = "Album system failed to load.";
    if (grid) {
      grid.innerHTML = `<div style="color:rgba(233,238,252,.75);padding:1rem;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(10,14,24,.35);">
        Could not load albums. Check Worker URL, Worker CORS, and that your index.html contains &lt;div id="albums"&gt;&lt;/div&gt;.
      </div>`;
    }
  }
}

// Shuffle current album
shuffleBtn?.addEventListener("click", () => {
  allItems = shuffle([...allItems]);
  rebuildMediaItems();
  render();
});

init();
