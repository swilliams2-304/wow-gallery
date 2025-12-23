/* =========================================================
   Williams Family Gallery — app.js (FULL COPY/PASTE)
   - Loads albums/items from Worker
   - Uses R2 public domain for media
   - Video thumbnails supported via item.poster (thumbs/<album>/<base>.jpg)
   - Album menu uses .album-btn + .active
   - Lightbox with arrows + swipe
   - Soft PIN gate: 64734
========================================================= */

/* ===========================
   CONFIG
=========================== */
const WORKER_BASE = "https://gallery-albums.swilliams2.workers.dev";
const R2_PUBLIC_BASE = "https://pub-69c220e7c10141e18ac15b9cf428ef86.r2.dev";

const SOFT_PIN = "64734";
const PIN_STORAGE_KEY = "wf_gallery_unlocked_v1";

// Hide these if they ever appear
const HIDDEN_ALBUMS = new Set(["thumbs", "images", "index.json"]);

/* ===========================
   DOM
=========================== */
// PIN gate
const pinGate = document.getElementById("pinGate");
const pinForm = document.getElementById("pinForm");
const pinInput = document.getElementById("pinInput");
const pinMsg = document.getElementById("pinMsg");

// Landing actions
const enterBtn = document.getElementById("enterBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

// Hero text
const albumNameEl = document.getElementById("albumName");
const albumSubtitleEl = document.getElementById("albumSubtitle");
const copyAlbumLinkBtn = document.getElementById("copyAlbumLinkBtn");

const albumsEl = document.getElementById("albums");
const gridEl = document.getElementById("grid");
const countEl = document.getElementById("count");

// Lightbox
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxVideo = document.getElementById("lightboxVideo");
const closeBtn = document.getElementById("closeBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const captionEl = document.getElementById("caption");

/* ===========================
   STATE
=========================== */
let albums = [];
let currentAlbum = null;
let items = [];          // from Worker: {type, src, alt, poster?}
let currentIndex = -1;

/* ===========================
   HELPERS
=========================== */
const qs = (k) => new URLSearchParams(location.search).get(k);

function withCacheBust(url) {
  // Helps avoid stale Worker responses
  const u = new URL(url);
  u.searchParams.set("v", Date.now().toString());
  return u.toString();
}

function workerUrl(path) {
  return withCacheBust(`${WORKER_BASE}${path}`);
}

function r2Url(key) {
  return `${R2_PUBLIC_BASE}/${key}`;
}

function safeText(x) {
  return (x ?? "").toString();
}

function isVideoKey(key) {
  return /\.(mp4|webm|mov)$/i.test(key);
}

function normalizeAlbumName(a) {
  return safeText(a).trim();
}

function albumKeyFromNameInsensitive(name) {
  const wanted = safeText(name).trim().toLowerCase();
  return albums.find(a => a.toLowerCase() === wanted) || null;
}

/* Fallback thumbnail (simple dark card) */
const FALLBACK_THUMB_DATA_URI =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#0b1220"/>
        <stop offset="1" stop-color="#05060a"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="520" cy="400" r="120" fill="rgba(42,167,255,0.18)"/>
    <circle cx="720" cy="400" r="120" fill="rgba(255,45,58,0.16)"/>
    <text x="50%" y="52%" fill="rgba(233,238,252,0.75)" font-size="48" text-anchor="middle" font-family="Arial, sans-serif">
      Video
    </text>
  </svg>
`);

/* ===========================
   PIN GATE
=========================== */
function isUnlocked() {
  return localStorage.getItem(PIN_STORAGE_KEY) === "1";
}

function setUnlocked() {
  localStorage.setItem(PIN_STORAGE_KEY, "1");
}

function hidePinGate() {
  if (!pinGate) return;
  pinGate.classList.add("hide");
  pinGate.setAttribute("aria-hidden", "true");
}

function showPinError(msg) {
  if (!pinMsg) return;
  pinMsg.textContent = msg;
}

function setupPinGate() {
  if (!pinGate) {
    // If PIN gate missing, just init
    init().catch((e) => console.error("INIT ERROR:", e));
    return;
  }

  if (isUnlocked()) {
    hidePinGate();
    init().catch((e) => console.error("INIT ERROR:", e));
    return;
  }

  setTimeout(() => pinInput?.focus(), 50);

  pinForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = safeText(pinInput?.value).trim();
    if (val === SOFT_PIN) {
      setUnlocked();
      hidePinGate();
      init().catch((err) => console.error("INIT ERROR:", err));
    } else {
      showPinError("Wrong passcode.");
      if (pinInput) pinInput.value = "";
      pinInput?.focus();
    }
  });
}

/* ===========================
   FETCHING
=========================== */
async function fetchJson(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

async function loadAlbums() {
  const data = await fetchJson(workerUrl("/albums"));
  const list = Array.isArray(data.albums) ? data.albums : [];

  albums = list
    .map(normalizeAlbumName)
    .filter(Boolean)
    .filter(a => !HIDDEN_ALBUMS.has(a.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  renderAlbumMenu();
}

async function loadAlbum(name) {
  const safeName = normalizeAlbumName(name);
  if (!safeName) throw new Error("Missing album name");

  const data = await fetchJson(workerUrl(`/album?name=${encodeURIComponent(safeName)}`));
  currentAlbum = data.title || safeName;
  items = Array.isArray(data.items) ? data.items : [];

  renderHero();
  renderGrid();
}

/* ===========================
   RENDER: HERO
=========================== */
function renderHero() {
  const n = items.length;

  if (albumNameEl) albumNameEl.textContent = currentAlbum || "Gallery";
  if (albumSubtitleEl) {
    albumSubtitleEl.textContent = n
      ? `${n} item${n === 1 ? "" : "s"} in this album.`
      : "No media found in this album yet.";
  }
  if (countEl) countEl.textContent = `${n} item${n === 1 ? "" : "s"}`;
}

/* ===========================
   RENDER: ALBUM MENU
=========================== */
function renderAlbumMenu() {
  if (!albumsEl) return;
  albumsEl.innerHTML = "";

  const currentParam = safeText(qs("album")).toLowerCase();

  for (const a of albums) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "album-btn";
    btn.textContent = a;

    const isActive =
      (currentParam && a.toLowerCase() === currentParam) ||
      (!currentParam && a === albums[0]);

    if (isActive) btn.classList.add("active");

    btn.addEventListener("click", () => {
      setActiveAlbumButton(a);
      navigateToAlbum(a);
    });

    albumsEl.appendChild(btn);
  }
}

function setActiveAlbumButton(name) {
  if (!albumsEl) return;
  const wanted = safeText(name).toLowerCase();
  albumsEl.querySelectorAll("button, a").forEach((el) => {
    const label = safeText(el.textContent).trim().toLowerCase();
    el.classList.toggle("active", label === wanted);
  });
}

function navigateToAlbum(name) {
  const u = new URL(location.href);
  u.searchParams.set("album", safeText(name).toLowerCase());
  history.pushState({}, "", u.toString());
  loadAlbum(name).catch(showAlbumError);
}

/* ===========================
   RENDER: GRID
=========================== */
function clearGrid() {
  if (gridEl) gridEl.innerHTML = "";
}

function showAlbumError(err) {
  console.error(err);
  clearGrid();

  if (albumNameEl) albumNameEl.textContent = "Album system failed to load.";
  if (albumSubtitleEl) albumSubtitleEl.textContent = "Could not load albums. Check Worker URL + CORS.";
  if (countEl) countEl.textContent = "—";
}

function makeVideoThumbImg(item) {
  const img = document.createElement("img");
  img.alt = item.alt || "Video";

  // ✅ Use explicit poster from Worker if available
  if (item.poster) {
    img.src = r2Url(item.poster);
  } else {
    // fallback if poster field missing
    img.src = FALLBACK_THUMB_DATA_URI;
  }

  // If poster fails to load (rare), fallback to built-in
  img.onerror = () => {
    img.src = FALLBACK_THUMB_DATA_URI;
  };

  img.loading = "lazy";
  img.decoding = "async";
  return img;
}

function makeImageThumbImg(item) {
  const img = document.createElement("img");
  img.alt = item.alt || "";
  img.src = r2Url(item.src);
  img.loading = "lazy";
  img.decoding = "async";
  img.onerror = () => {
    img.src = FALLBACK_THUMB_DATA_URI;
  };
  return img;
}

function makeCard(item, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "card";

  if (item.type === "video") {
    card.classList.add("is-video");
    card.appendChild(makeVideoThumbImg(item));

    // play badge overlay (if your CSS supports it)
    const badge = document.createElement("div");
    badge.className = "play-badge";
    const tri = document.createElement("div");
    tri.className = "play-triangle";
    badge.appendChild(tri);
    card.appendChild(badge);
  } else {
    card.appendChild(makeImageThumbImg(item));
  }

  card.addEventListener("click", () => openLightbox(index));
  return card;
}

function renderGrid() {
  clearGrid();
  if (!gridEl) return;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.75";
    empty.style.textAlign = "center";
    empty.style.padding = "1.5rem 0";
    empty.textContent = "No photos/videos in this album yet.";
    gridEl.appendChild(empty);
    return;
  }

  items.forEach((it, i) => {
    // Normalize type if Worker ever returns only src
    if (!it.type) it.type = isVideoKey(it.src) ? "video" : "image";
    gridEl.appendChild(makeCard(it, i));
  });
}

/* ===========================
   LIGHTBOX
=========================== */
function setCaption(text) {
  if (captionEl) captionEl.textContent = text || "";
}

function showImage(item) {
  // Stop/clear video
  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.removeAttribute("poster");
    lightboxVideo.load();
    lightboxVideo.style.display = "none";
  }

  if (lightboxImg) {
    lightboxImg.style.display = "block";
    lightboxImg.src = r2Url(item.src);
    lightboxImg.alt = item.alt || "";
  }
}

function showVideo(item) {
  // Clear image
  if (lightboxImg) {
    lightboxImg.removeAttribute("src");
    lightboxImg.style.display = "none";
  }

  if (lightboxVideo) {
    lightboxVideo.style.display = "block";
    lightboxVideo.src = r2Url(item.src);

    // ✅ Use poster in lightbox too (nice polish)
    if (item.poster) {
      lightboxVideo.poster = r2Url(item.poster);
    } else {
      lightboxVideo.removeAttribute("poster");
    }

    lightboxVideo.load();
  }
}

function openLightbox(index) {
  currentIndex = index;
  const item = items[currentIndex];
  if (!item) return;

  if (item.type === "video") showVideo(item);
  else showImage(item);

  setCaption(item.alt || "");

  if (lightbox) {
    lightbox.classList.add("show");
    lightbox.setAttribute("aria-hidden", "false");
  }
}

function closeLightbox() {
  if (!lightbox) return;

  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden", "true");

  // Stop video if playing
  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.removeAttribute("poster");
    lightboxVideo.load();
  }
}

function showPrev() {
  if (!items.length) return;
  currentIndex = (currentIndex - 1 + items.length) % items.length;
  openLightbox(currentIndex);
}

function showNext() {
  if (!items.length) return;
  currentIndex = (currentIndex + 1) % items.length;
  openLightbox(currentIndex);
}

/* Swipe support */
let touchStartX = null;

function setupSwipe() {
  if (!lightbox) return;

  lightbox.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches?.[0]?.clientX ?? null;
  }, { passive: true });

  lightbox.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const endX = e.changedTouches?.[0]?.clientX ?? touchStartX;
    const dx = endX - touchStartX;
    touchStartX = null;

    if (Math.abs(dx) < 40) return;
    if (dx > 0) showPrev();
    else showNext();
  }, { passive: true });
}

/* ===========================
   LANDING + MISC
=========================== */
function scrollToAlbums() {
  const el = document.querySelector(".album-bar") || albumsEl;
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function shuffleAlbum() {
  if (!albums.length) return;
  const pick = albums[Math.floor(Math.random() * albums.length)];
  setActiveAlbumButton(pick);
  navigateToAlbum(pick);
  scrollToAlbums();
}

async function copyAlbumLink() {
  const u = new URL(location.href);
  if (currentAlbum) u.searchParams.set("album", currentAlbum.toLowerCase());

  try {
    await navigator.clipboard.writeText(u.toString());
    if (albumSubtitleEl) albumSubtitleEl.textContent = "Album link copied ✅";
    setTimeout(renderHero, 900);
  } catch {
    window.prompt("Copy this album link:", u.toString());
  }
}

/* ===========================
   WIRE UI
=========================== */
function wireUI() {
  closeBtn?.addEventListener("click", closeLightbox);
  prevBtn?.addEventListener("click", showPrev);
  nextBtn?.addEventListener("click", showNext);

  // click outside viewer closes
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  window.addEventListener("keydown", (e) => {
    if (!lightbox?.classList.contains("show")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "ArrowRight") showNext();
  });

  setupSwipe();

  enterBtn?.addEventListener("click", scrollToAlbums);
  shuffleBtn?.addEventListener("click", shuffleAlbum);

  copyAlbumLinkBtn?.addEventListener("click", copyAlbumLink);

  window.addEventListener("popstate", () => {
    const a = qs("album");
    if (a) loadAlbum(albumKeyFromNameInsensitive(a) || a).catch(showAlbumError);
  });
}

/* ===========================
   INIT
=========================== */
async function init() {
  wireUI();

  await loadAlbums();

  const fromUrl = qs("album");
  const chosen = fromUrl
    ? (albumKeyFromNameInsensitive(fromUrl) || normalizeAlbumName(fromUrl))
    : (albums[0] || null);

  if (!chosen) {
    if (albumNameEl) albumNameEl.textContent = "No albums found.";
    if (albumSubtitleEl) albumSubtitleEl.textContent = "Create a folder in R2 and upload at least one image/video.";
    if (countEl) countEl.textContent = "0 items";
    return;
  }

  setActiveAlbumButton(chosen);
  await loadAlbum(chosen);
}

/* BOOT */
setupPinGate();





