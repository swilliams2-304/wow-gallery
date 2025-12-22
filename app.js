// =====================
// CONFIG
// =====================
const R2_BASE_URL = "https://pub-69c220e7c10141e18ac15b9cf428ef86.r2.dev";
const WORKER_BASE_URL = "https://gallery-albums.swilliams2.workers.dev";

const ALBUMS_URL = `${WORKER_BASE_URL}/albums`;
const ALBUM_URL = (name) => `${WORKER_BASE_URL}/album?name=${encodeURIComponent(name)}`;
const POSTER_UPLOAD_URL = `${WORKER_BASE_URL}/poster`;

// Admin mode: visit site with ?admin=1
const IS_ADMIN = new URLSearchParams(location.search).get("admin") === "1";

// =====================
// DOM
// =====================
const grid = document.getElementById("grid");
const count = document.getElementById("count");
const shuffleBtn = document.getElementById("shuffleBtn");

const albumsEl = document.getElementById("albums");

// Hero (Option 1)
const heroEl = document.getElementById("hero");
const albumNameEl = document.getElementById("albumName");
const albumSubtitleEl = document.getElementById("albumSubtitle");
const copyAlbumLinkBtn = document.getElementById("copyAlbumLinkBtn");

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
let allItems = [];
let mediaItems = [];
let currentIndex = -1;
let currentAlbum = null;

let adminToken = null;

// =====================
// URL helpers (deep links)
// =====================
function getRequestedAlbumFromUrl() {
  const u = new URL(location.href);
  const a = u.searchParams.get("album");
  return a ? a.trim() : null;
}

function setAlbumInUrl(albumKey) {
  const u = new URL(location.href);
  u.searchParams.set("album", albumKey);
  if (IS_ADMIN) u.searchParams.set("admin", "1");
  history.replaceState({}, "", u.toString());
}

async function copyCurrentAlbumLink() {
  if (!currentAlbum) return;

  const u = new URL(location.href);
  u.searchParams.set("album", currentAlbum);
  if (IS_ADMIN) u.searchParams.set("admin", "1");

  const text = u.toString();

  try {
    await navigator.clipboard.writeText(text);
    alert("Album link copied to clipboard ✅");
  } catch {
    prompt("Copy this album link:", text);
  }
}

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

// Hero metadata (Option 1)
const albumMeta = {
  family: {
    subtitle: "The highlight reel: laughter, chaos, and the good kind of noise.",
    accent: "42,167,255" // blue
  },
  piper: {
    subtitle: "Piper moments, captured mid-spark.",
    accent: "255,45,58" // red
  },
  phoebe: {
    subtitle: "Phoebe’s world: small moments with big energy.",
    accent: "42,167,255" // blue
  },
  "pipers-quinceanera": {
    subtitle: "A night with a heartbeat. Dress. Lights. Memories.",
    accent: "255,45,58" // red
  }
};

function updateHero(albumKey) {
  const title = prettyAlbumName(albumKey);
  const meta = albumMeta[albumKey] || {
    subtitle: "Memories, neatly framed.",
    accent: "42,167,255"
  };

  if (albumNameEl) albumNameEl.textContent = title;
  if (albumSubtitleEl) albumSubtitleEl.textContent = meta.subtitle;

  // shift glow accent
  document.documentElement.style.setProperty("--hero-accent", meta.accent);

  // pulse animation
  if (heroEl) {
    heroEl.classList.remove("pulse");
    void heroEl.offsetWidth;
    heroEl.classList.add("pulse");
  }
}

function setActiveAlbumButton(name) {
  if (!albumsEl) return;
  [...albumsEl.querySelectorAll("button")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.album === name);
  });
}

// =====================
// GRID RENDER
// =====================
function render() {
  if (!grid || !count) return;

  grid.innerHTML = "";

  mediaItems.forEach((it, idx) => {
    const mediaUrl = `${R2_BASE_URL}/${it.src}`;

    // If it's a video and Worker provided a poster key, use poster for tile
    const posterUrl =
      isVideoItem(it) && it.poster ? `${R2_BASE_URL}/${it.poster}` : null;

    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.setAttribute("aria-label", it.alt || `Open item ${idx + 1}`);

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = posterUrl || mediaUrl;
    img.alt = it.alt || "";

    if (isVideoItem(it)) {
      card.classList.add("is-video");
      const badge = document.createElement("div");
      badge.className = "play-badge";
      badge.innerHTML = `<span class="play-triangle"></span>`;
      card.appendChild(badge);
    }

    card.addEventListener("click", () => openLightbox(idx));

    card.appendChild(img);
    grid.appendChild(card);
  });

  const albumLabel = currentAlbum ? ` • ${prettyAlbumName(currentAlbum)}` : "";
  const adminLabel = IS_ADMIN ? " • ADMIN" : "";
  count.textContent = `${mediaItems.length} items${albumLabel}${adminLabel}`;
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

closeBtn?.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
prevBtn?.addEventListener("click", (e) => { e.stopPropagation(); showPrev(); });
nextBtn?.addEventListener("click", (e) => { e.stopPropagation(); showNext(); });

lightbox?.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (e) => {
  if (!lightbox || !lightbox.classList.contains("show")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") showPrev();
  if (e.key === "ArrowRight") showNext();
});

// Swipe support
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
  return await res.json();
}

// =====================
// ADMIN THUMBNAILS
// =====================
async function generatePosterBase64(videoUrl) {
  const res = await fetch(videoUrl, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`Video fetch failed (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = blobUrl;

    const cleanup = () => {
      try { URL.revokeObjectURL(blobUrl); } catch {}
      v.pause();
      v.removeAttribute("src");
      v.load();
    };

    v.addEventListener("error", () => {
      cleanup();
      reject(new Error("Video could not be decoded for thumbnail generation."));
    });

    v.addEventListener("loadedmetadata", () => {
      try {
        const t = Math.max(0.1, Math.min(1.0, (v.duration || 1) * 0.1));
        v.currentTime = t;
      } catch (e) {
        cleanup();
        reject(e);
      }
    });

    v.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        const w = v.videoWidth || 1280;
        const h = v.videoHeight || 720;

        const maxW = 900;
        const scale = Math.min(1, maxW / w);

        canvas.width = Math.floor(w * scale);
        canvas.height = Math.floor(h * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const base64 = dataUrl.split(",")[1];

        cleanup();
        resolve(base64);
      } catch (e) {
        cleanup();
        reject(e);
      }
    });
  });
}

async function uploadPoster(posterKey, bytesBase64) {
  if (!adminToken) throw new Error("Missing admin token.");

  const res = await fetch(POSTER_UPLOAD_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      posterKey,
      bytesBase64,
      contentType: "image/jpeg"
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Poster upload failed (${res.status}): ${txt}`);
  }
}

async function runAdminThumbnailGenerator() {
  if (!adminToken) {
    adminToken = prompt("ADMIN mode: Enter THUMBNAIL_TOKEN to generate video thumbnails:");
    if (!adminToken) {
      alert("Admin cancelled. No thumbnails generated.");
      return;
    }
  }

  if (!currentAlbum) {
    alert("No album selected yet. Wait for albums to load, then try again.");
    return;
  }

  const videos = (allItems || []).filter(it => it && it.type === "video" && it.src && it.poster);

  if (!videos.length) {
    alert("No videos found in this album.");
    return;
  }

  count.textContent = `ADMIN: generating posters (${videos.length})…`;

  let ok = 0;
  let fail = 0;

  for (const it of videos) {
    try {
      const videoUrl = `${R2_BASE_URL}/${it.src}`;
      const base64 = await generatePosterBase64(videoUrl);
      await uploadPoster(it.poster, base64);
      ok++;
    } catch (e) {
      console.error("Poster failed for", it.src, e);
      fail++;
    }
  }

  const refreshed = await loadAlbum(currentAlbum);
  allItems = refreshed.items || [];
  rebuildMediaItems();
  render();

  count.textContent = `ADMIN: posters done (ok ${ok}, failed ${fail}) • ${prettyAlbumName(currentAlbum)}`;
  if (fail > 0) {
    alert(`Generated posters: ${ok}\nFailed: ${fail}\n\nIf failures happen, it's usually codec/CORS. MP4 (H.264) works best.`);
  }
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
      throw new Error("Missing #albums element in index.html.");
    }

    // Hero copy-link button
    copyAlbumLinkBtn?.addEventListener("click", copyCurrentAlbumLink);

    // (Optional) Keep the old copy button in the album bar too
    const copyBtn = document.createElement("button");
    copyBtn.className = "album-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy album link";
    copyBtn.addEventListener("click", copyCurrentAlbumLink);

    // Build album buttons
    albumsEl.innerHTML = "";
    albumsEl.appendChild(copyBtn);

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
        setAlbumInUrl(a);
        setActiveAlbumButton(a);
        updateHero(a);

        allItems = data.items || [];
        rebuildMediaItems();
        render();

        if (IS_ADMIN) {
          const wants = confirm(`ADMIN mode is ON.\n\nGenerate/refresh video thumbnails for album: ${prettyAlbumName(a)} ?`);
          if (wants) await runAdminThumbnailGenerator();
        }
      });

      albumsEl.appendChild(btn);
    });

    // Choose initial album: ?album=..., else family, else first
    const requested = getRequestedAlbumFromUrl();
    const initial =
      (requested && albums.includes(requested)) ? requested :
      (albums.includes("family") ? "family" : albums[0]);

    const data = await loadAlbum(initial);

    currentAlbum = initial;
    setAlbumInUrl(initial);
    setActiveAlbumButton(initial);
    updateHero(initial);

    allItems = data.items || [];
    rebuildMediaItems();
    render();

    if (IS_ADMIN) {
      const wants = confirm(`ADMIN mode is ON.\n\nGenerate/refresh video thumbnails for album: ${prettyAlbumName(initial)} ?`);
      if (wants) await runAdminThumbnailGenerator();
    }
  } catch (err) {
    console.error("INIT ERROR:", err);
    if (count) count.textContent = "Album system failed to load.";
    if (grid) {
      grid.innerHTML = `<div style="color:rgba(233,238,252,.75);padding:1rem;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(10,14,24,.35);">
        Could not load albums. Check Worker URL + CORS.
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


