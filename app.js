const R2_BASE_URL = "https://pub-69c220e7c10141e18ac15b9cf428ef86.r2.dev";

// cache-bust index so updates show right away
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

let currentItems = [];
let currentIndex = -1;

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getImageItems(items){
  return items.filter(i => i.type === "image" && i.src);
}

function render(items){
  const imgs = getImageItems(items);
  grid.innerHTML = "";

  imgs.forEach((it, idx) => {
    const src = `${R2_BASE_URL}/${it.src}`;

    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.title = it.alt || `Photo ${idx + 1}`;

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = src;
    img.alt = it.alt || "";

    // Open lightbox at this index
    card.addEventListener("click", () => openLightbox(idx));

    card.appendChild(img);
    grid.appendChild(card);
  });

  count.textContent = `${imgs.length} photos`;
}

function openLightbox(idx){
  const imgs = getImageItems(currentItems);
  if (!imgs.length) return;

  currentIndex = Math.max(0, Math.min(idx, imgs.length - 1));
  const it = imgs[currentIndex];

  lightboxImg.src = `${R2_BASE_URL}/${it.src}`;
  lightboxImg.alt = it.alt || "";
  caption.textContent = it.alt ? it.alt : `Photo ${currentIndex + 1} of ${imgs.length}`;

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
  const imgs = getImageItems(currentItems);
  if (!imgs.length) return;
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = (currentIndex - 1 + imgs.length) % imgs.length;
  openLightbox(currentIndex);
}

function showNext(){
  const imgs = getImageItems(currentItems);
  if (!imgs.length) return;
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = (currentIndex + 1) % imgs.length;
  openLightbox(currentIndex);
}

// Buttons
closeBtn?.addEventListener("click", closeLightbox);
prevBtn?.addEventListener("click", (e) => { e.stopPropagation(); showPrev(); });
nextBtn?.addEventListener("click", (e) => { e.stopPropagation(); showNext(); });

// Click outside image closes
lightbox.addEventListener("click", (e) => {
  // If clicking the overlay (not the image/buttons), close
  if (e.target === lightbox) closeLightbox();
});

// Keyboard controls
document.addEventListener("keydown", (e) => {
  if (!lightbox.classList.contains("show")) return;

  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") showPrev();
  if (e.key === "ArrowRight") showNext();
});

async function init(){
  try{
    const res = await fetch(INDEX_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
    const data = await res.json();
    currentItems = data.items || [];
    render(currentItems);
  } catch (err){
    console.error(err);
    count.textContent = "Could not load gallery index.";
    grid.innerHTML = `<div style="color:rgba(233,238,252,.75);padding:1rem;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(10,14,24,.35);">
      Fix: Ensure index.json exists in R2 root + CORS allows https://wow-gallery.pages.dev
    </div>`;
  }
}

shuffleBtn.addEventListener("click", () => {
  currentItems = shuffle([...currentItems]);
  render(currentItems);
});

init();
