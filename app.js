/* =========================================================
   Williams Family Gallery — app.js (FULL)
   - Pages frontend
   - Albums + items from Worker
   - Media from R2 public domain
   - Video posters auto-detected
   - Lightbox + arrows + swipe
   - Soft PIN gate
========================================================= */

/* ===========================
   CONFIG
=========================== */
const WORKER_BASE = "https://gallery-albums.swilliams2.workers.dev";
const R2_PUBLIC_BASE = "https://pub-69c220e7c10141e18ac15b9cf428ef86.r2.dev";

// Soft PIN
const SOFT_PIN = "64734";
const PIN_STORAGE_KEY = "wf_gallery_unlocked_v1";

// Hide these from album menu no matter what
const HIDDEN_ALBUMS = new Set(["thumbs", "images", "index.json"]);

/* ===========================
   DOM
=========================== */
const pinGate = document.getElementById("pinGate");
const pinForm = document.getElementById("pinForm");
const pinInput = document.getElementById("pinInput");
const pinMsg = document.getElementById("pinMsg");

const enterBtn = document.getElementById("enterBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

const albumNameEl = document.getElementById("albumName");
const albumSubtitleEl = document.getElementById("albumSubtitle");
const copyAlbumLinkBtn = document.getElementById("copyAlbumLinkBtn");

const albumsEl = document.getElementById("albums");
const gridEl = document.getElementById("grid");
const countEl = document.getElementById("count");

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
let items = [];           // {type, src, alt}
let currentIndex = -1;

/* ===========================
   UTIL
=========================== */
const qs = (k) => new URLSearchParams(location.search).get(k);

function normalizeAlbumName(a) {
  return (a || "").trim();
}

function albumKeyFromName(name) {
  // Worker uses actual folder names; URLs can be lower/encoded
  // We'll treat query param as a case-insensitive match.
  const wanted = (name || "").trim().toLowerCase();
  const match = albums.find(a => a.toLowerCase() === wanted);
  return match || null;
}

function withCacheBust(url) {
  const u = new URL(url);
  u.searchParams.set("v", Date.now().toString());
  return u.toString();
}

function workerUrl(path) {
  return withCacheBust(`${WORKER_BASE}${path}`);
}

function r2Url(key) {
  // key like "family/photo.jpg" (no leading slash)
  return `${R2_PUBLIC_BASE}/${key}`;
}

function isVideoKey(key) {
  return /\.(mp4|webm|mov)$/i.test(key);
}

function posterCandidatesFor(videoKey) {
  // videoKey: "family/test.mp4"
  const parts = videoKey.split("/");
  const album = parts[0];
  const file = parts[parts.length - 1];     // "test.mp4"
  const base = file.replace(/\.(mp4|webm|mov)$/i, ""); // "test"

  // Try both naming conventions:
  // 1) base.jpg (test.jpg)
  // 2) file.ext.jpg (test.mp4.jpg)  <-- very common
  return [
    `thumbs/${album}/${base}.jpg`,
    `thumbs/${album}/${base}.webp`,
    `thumbs/${album}/${file}.jpg`,
    `thumbs/${album}/${file}.webp`,

    `${album}/thumbs/${base}.jpg`,
    `${album}/thumbs/${base}.webp`,
    `${album}/thumbs/${file}.jpg`,
    `${album}/thumbs/${file}.webp`,
  ];
}
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
  if (!pinGate) return;

  if (isUnlocked()) {
    hidePinGate();
    init().catch((e) => console.error("INIT ERROR:", e));
    return;
  }

  // focus input
  setTimeout(() => pinInput?.focus(), 50);

  pinForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = (pinInput?.value || "").trim();
    if (val === SOFT_PIN) {
      setUnlocked();
      hidePinGate();
      init().catch((e) => console.error("INIT ERROR:", e));
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
    .filter(a => !HIDDEN_ALBUMS.has(a.toLowerCase()));

  // If you want alphabetical:
  albums.sort((a, b) => a.localeCompare(b));

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
  if (albumNameEl) albumNameEl.textContent = currentAlbum || "Gallery";
  if (albumSubtitleEl) {
    const n = items.length;
    albumSubtitleEl.textContent = n
      ? `${n} item${n === 1 ? "" : "s"} in this album.`
      : "No media found in this album yet.";
  }
  if (countEl) {
    const n = items.length;
    countEl.textContent = `${n} item${n === 1 ? "" : "s"}`;
  }
}

/* ===========================
   RENDER: ALBUM MENU
=========================== */
function renderAlbumMenu() {
  if (!albumsEl) return;
  albumsEl.innerHTML = "";

  const currentParam = (qs("album") || "").toLowerCase();

  for (const a of albums) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "album-btn";
    btn.textContent = a;

    if (a.toLowerCase() === currentParam || (!currentParam && a === albums[0])) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      setActiveAlbumButton(a);
      navigateToAlbum(a);
    });

    albumsEl.appendChild(btn);
  }
}

function setActiveAlbumButton(name) {
  const wanted = (name || "").toLowerCase();
  [...albumsEl.querySelectorAll(".album-btn")].forEach((b) => {
    b.classList.toggle("active", b.textContent.trim().toLowerCase() === wanted);
  });
}

function navigateToAlbum(name) {
  const u = new URL(location.href);
  u.searchParams.set("album", name.toLowerCase());
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

function makeCard(item, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "card";
  if (item.type === "video") card.classList.add("is-video");

  // Thumbnail image (for images, this is the actual image; for video, poster)
  const thumb = document.createElement("img");
  thumb.alt = item.alt || "";

  if (item.type === "image") {
    thumb.src = r2Url(item.src);
  } else {
    // video: try poster candidates, fallback to the video itself (browser might show first frame)
    const candidates = posterCandidatesFor(item.src).map(r2Url);
    let attempt = 0;
    thumb.src = candidates[attempt];

    thumb.onerror = () => {
      attempt++;
      if (attempt < candidates.length) {
        thumb.src = candidates[attempt];
      } else {
        // final fallback: try using the video as src (some browsers will still paint a frame in <img> = no, so use a generic look)
        // We'll keep the last poster attempt; card will still show play badge.
        // (If you want a custom fallback image later, tell me and I’ll add it.)
      }
    };

    // play badge overlay
    const badge = document.createElement("div");
    badge.className = "play-badge";
    const tri = document.createElement("div");
    tri.className = "play-triangle";
    badge.appendChild(tri);
    card.appendChild(badge);
  }

  card.appendChild(thumb);

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

  items.forEach((it, i) => gridEl.appendChild(makeCard(it, i)));
}

/* ===========================
   LIGHTBOX
=========================== */
function setCaption(text) {
  if (captionEl) captionEl.textContent = text || "";
}

function showImage(srcKey, alt) {
  lightboxVideo.pause();
  lightboxVideo.removeAttribute("src");
  lightboxVideo.load();

  lightboxImg.style.display = "block";
  lightboxVideo.style.display = "none";

  lightboxImg.src = r2Url(srcKey);
  lightboxImg.alt = alt || "";
}

function showVideo(srcKey) {
  lightboxImg.removeAttribute("src");
  lightboxImg.style.display = "none";

  lightboxVideo.style.display = "block";
  lightboxVideo.src = r2Url(srcKey);
  lightboxVideo.load();
}

function openLightbox(index) {
  currentIndex = index;
  const item = items[currentIndex];
  if (!item) return;

  if (item.type === "video") showVideo(item.src);
  else showImage(item.src, item.alt);

  setCaption(item.alt || "");

  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden", "true");

  // stop video
  lightboxVideo.pause();
  lightboxVideo.removeAttribute("src");
  lightboxVideo.load();
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

/* Swipe support (mobile) */
let touchStartX = null;
function setupSwipe() {
  if (!lightbox) return;

  lightbox.addEventListener("touchstart", (e) => {
    if (!e.changedTouches?.length) return;
    touchStartX = e.changedTouches[0].clientX;
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
   LANDING ACTIONS
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

/* ===========================
   MISC
=========================== */
async function copyAlbumLink() {
  const u = new URL(location.href);
  if (currentAlbum) u.searchParams.set("album", currentAlbum.toLowerCase());
  try {
    await navigator.clipboard.writeText(u.toString());
    if (albumSubtitleEl) albumSubtitleEl.textContent = "Album link copied to clipboard ✅";
    setTimeout(renderHero, 1200);
  } catch {
    // fallback: prompt
    window.prompt("Copy this album link:", u.toString());
  }
}

function wireUI() {
  closeBtn?.addEventListener("click", closeLightbox);
  prevBtn?.addEventListener("click", showPrev);
  nextBtn?.addEventListener("click", showNext);

  // click backdrop closes (but don’t close when clicking media/buttons)
  lightbox?.addEventListener("click", (e) => {
    const t = e.target;
    if (t === lightbox) closeLightbox();
  });

  window.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("show")) return;
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
    if (a) loadAlbum(albumKeyFromName(a) || a).catch(showAlbumError);
  });
}

/* ===========================
   INIT
=========================== */
async function init() {
  wireUI();

  await loadAlbums();

  // Choose album
  const fromUrl = qs("album");
  const chosen = fromUrl
    ? (albumKeyFromName(fromUrl) || normalizeAlbumName(fromUrl))
    : (albums[0] || null);

  if (!chosen) {
    // no albums exist
    if (albumNameEl) albumNameEl.textContent = "No albums found.";
    if (albumSubtitleEl) albumSubtitleEl.textContent = "Create a folder in R2 and upload at least one image/video.";
    if (countEl) countEl.textContent = "0 items";
    return;
  }

  setActiveAlbumButton(chosen);
  await loadAlbum(chosen);
}

/* Boot */
setupPinGate();




