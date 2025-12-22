// TODO: Paste your R2 public base URL here once created
const R2_BASE_URL = "https://PASTE-YOUR-R2-PUBLIC-URL-HERE";
const INDEX_URL = `${R2_BASE_URL}/index.json`;

const grid = document.getElementById("grid");
const count = document.getElementById("count");
const shuffleBtn = document.getElementById("shuffleBtn");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const closeBtn = document.getElementById("closeBtn");

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function openLightbox(src, alt){
  lightboxImg.src = src;
  lightboxImg.alt = alt || "";
  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden", "false");
}
function closeLightbox(){
  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImg.src = "";
}
closeBtn.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

let currentItems = [];

function render(items){
  grid.innerHTML = "";
  items.forEach((it) => {
    if (it.type !== "image") return;
    const src = `${R2_BASE_URL}/${it.src}`;
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = src;
    img.alt = it.alt || "";
    img.addEventListener("click", () => openLightbox(src, it.alt));

    card.appendChild(img);
    grid.appendChild(card);
  });

  count.textContent = `${items.filter(i=>i.type==="image").length} photos`;
}

async function init(){
  try{
    const res = await fetch(INDEX_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
    const data = await res.json();
    currentItems = data.items || [];
    render(currentItems);
  } catch (err){
    console.error(err);
    count.textContent = "Gallery not connected yet (R2_BASE_URL missing).";
    grid.innerHTML = `<div style="color:rgba(233,238,252,.75);padding:1rem;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(10,14,24,.35);">
      Next step: create R2 bucket + public URL, upload index.json + images, then paste R2_BASE_URL in app.js.
    </div>`;
  }
}

shuffleBtn.addEventListener("click", () => {
  currentItems = shuffle([...currentItems]);
  render(currentItems);
});

init();
