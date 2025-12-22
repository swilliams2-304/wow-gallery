const R2_BASE_URL = "https://pub-69c220e7c10141e18ac15b9cf428ef86.r2.dev";
const INDEX_URL = `${R2_BASE_URL}/index.json?v=${Date.now()}`;

const grid = document.getElementById("grid");
const count = document.getElementById("count");
const shuffleBtn = document.getElementById("shuffleBtn");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const caption = document.getElementById("caption");

const closeBtn = document.getElementById("closeBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let allItems = [];
let imageItems = [];      // the exact list we render + navigate
let currentIndex = -1;

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rebuildImageItems(){
  imageItems = (allItems || []).filter(it => it && it.type === "image" && it.src);
}

function render(){
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

    // IMPORTANT: open by index into imageItems (stable)
    card.addEventListener("click", () => openLightbox(idx));

    card.appendChild(img);
    grid.appendChild(card);
  });

  count.textContent = `${imageItems.length} photos`;
}

function openLightbox(idx){
  if (!imageItems.length) return;

  currentIndex = Math.max(0, Math.min(idx, imageItems.length - 1));
  const it = imageItems[currentIndex];

  lightboxImg.src = `${R2_BASE_URL}/${it.src}`;
  lightboxImg.alt = it.alt || "";
  caption.textContent = it.alt ? it.alt : `Photo ${currentIndex + 1} of ${imageItems.length}`;

  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox(){
  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImg.src = "";
  caption.textContent = "";
  currentIndex = -1;
}

function showPrev(){
  if (!imageItems.length) return;
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = (currentIndex - 1 + imageItems.length) % imageItems.length;
  openLightbox(currentIndex);
}

function showNext(){
  if (!imageItems.length) return;
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = (currentIndex + 1) % imageItems.length;
  openLightbox(currentIndex);
}

// Wire up controls (only if elements exist)
if (closeBtn) closeBtn.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
if (prevBtn)  prevBtn.addEventListener("click",  (e) => { e.stopPropagation(); showPrev(); });
if (nextBtn)  nextBtn.addEventListener("click",  (e) => { e.stopPropagation(); showNext(); });

// Click outside viewer closes
if (lightbox){
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (!lightbox || !lightbox.classList.contains("show")) return;

  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") showPrev();
  if (e.key === "ArrowRight") showNext();
});

// Swipe support (mobile) - guarded so it can't break the page
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

    // deadzone to prevent accidental flips
    if (Math.abs(dx) < 40) return;

    if (dx > 0) showPrev();
    else showNext();
  }, { passive: true });
}

async function init(){
  try{
    const res = await fetch(INDEX_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);

    const data = await res.json();
    allItems = data.items || [];
    rebuildImageItems();
    render();
  } catch (err){
    console.error(err);
    count.textContent = "Could not load gallery index.";
    grid.innerHTML = `<div style="color:rgba(233,238,252,.75);padding:1rem;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(10,14,24,.35);">
      Open DevTools → Console to see the error. Common causes: index.json missing, CORS blocked, or filename mismatch.
    </div>`;
  }
}

shuffleBtn.addEventListener("click", () => {
  allItems = shuffle([...allItems]);
  rebuildImageItems();
  render();
});

init();


init();
