/* =========================
   CONFIG
========================= */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxNvby0oATUZBVxg9VcrlzaQyU3LLG2YYS_0z43HMEIz3THf2s-m8TVOGcUvPe9QpkRtg/exec";

/* =========================
   BASIC SETTINGS
========================= */

const INITIAL_PAGE = "scan";
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

/* =========================
   ELEMENTS
========================= */

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const pinEl = document.getElementById("pin");
const btnLogin = document.getElementById("btnLogin");
const btnClearPin = document.getElementById("btnClearPin");
const loginStatusEl = document.getElementById("loginStatus");

const videoEl = document.getElementById("video");
const scanStatusEl = document.getElementById("scanStatus");
const scanDebugEl = document.getElementById("scanDebug");
const lookupStatusEl = document.getElementById("lookupStatus");
const moveStatusEl = document.getElementById("moveStatus");
const productBoxEl = document.getElementById("productBox");

const codeEl = document.getElementById("code");
const qtyEl = document.getElementById("qty");
const refEl = document.getElementById("ref");
const noteEl = document.getElementById("note");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const btnTorch = document.getElementById("btnTorch");
const btnLookup = document.getElementById("btnLookup");
const btnClear = document.getElementById("btnClear");
const btnIn = document.getElementById("btnIn");
const btnOut = document.getElementById("btnOut");
const btnCreate = document.getElementById("btnCreate");
const btnEdit = document.getElementById("btnEdit");

const scanModeEl = document.getElementById("scanMode");
const scanDelayEl = document.getElementById("scanDelay");

const scannerWrap = document.getElementById("scannerWrap");

const createCard = document.getElementById("createCard");
const cSku = document.getElementById("cSku");
const cBarcode = document.getElementById("cBarcode");
const cName = document.getElementById("cName");
const cLocation = document.getElementById("cLocation");
const cQty = document.getElementById("cQty");
const cMin = document.getElementById("cMin");
const cNotes = document.getElementById("cNotes");
const btnSaveCreate = document.getElementById("btnSaveCreate");
const btnCancelCreate = document.getElementById("btnCancelCreate");
const createStatusEl = document.getElementById("createStatus");

const editCard = document.getElementById("editCard");
const eSku = document.getElementById("eSku");
const eBarcode = document.getElementById("eBarcode");
const eName = document.getElementById("eName");
const eLocation = document.getElementById("eLocation");
const eMin = document.getElementById("eMin");
const eNotes = document.getElementById("eNotes");
const btnSaveEdit = document.getElementById("btnSaveEdit");
const btnCancelEdit = document.getElementById("btnCancelEdit");
const editStatusEl = document.getElementById("editStatus");
const btnScanEditBarcode = document.getElementById("btnScanEditBarcode");

const tabScan = document.getElementById("tabScan");
const tabLow = document.getElementById("tabLow");
const tabInv = document.getElementById("tabInv");

const scanView = document.getElementById("scanView");
const lowView = document.getElementById("lowView");
const invView = document.getElementById("invView");

const btnLowRefresh = document.getElementById("btnLowRefresh");
const lowStatus = document.getElementById("lowStatus");
const lowList = document.getElementById("lowList");

const invSearch = document.getElementById("invSearch");
const btnInvRefresh = document.getElementById("btnInvRefresh");
const invStatus = document.getElementById("invStatus");
const invList = document.getElementById("invList");

const productImg = document.getElementById("productImg");
const productImgEmpty = document.getElementById("productImgEmpty");
const editImg = document.getElementById("editImg");
const editImgEmpty = document.getElementById("editImgEmpty");
const btnAddImage = document.getElementById("btnAddImage");
const btnAddImageEdit = document.getElementById("btnAddImageEdit");
const imgPicker = document.getElementById("imgPicker");

/* =========================
   STATE
========================= */

let SESSION_TOKEN = localStorage.getItem("inv_session_token") || "";

let stream = null;
let scanning = false;
let rafId = null;
let zxingReader = null;
let zxingRunning = false;

let scanLock = false;
let lastScanVal = "";
let lastScanAt = 0;

let torchOn = false;
let torchCapable = false;

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

let currentProduct = null;
let scanTarget = "DEFAULT";
let imgTarget = "PRODUCT";

/* =========================
   UTIL
========================= */

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

if (IS_IOS) {
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!t) return;
    if (!(t.matches && t.matches("input, textarea, select"))) return;
    setTimeout(() => {
      try { window.scrollTo(0, window.scrollY); } catch (_) {}
    }, 60);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (window.visualViewport.scale && window.visualViewport.scale !== 1) {
        setTimeout(() => {
          try { window.scrollTo(0, window.scrollY); } catch (_) {}
        }, 60);
      }
    });
  }
}

function setStatus(el, msg, type) {
  if (!el) return;
  el.classList.remove("ok", "err", "muted");
  el.classList.add(type || "muted");
  el.textContent = msg || "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
}

function isLikelyBarcode(s) {
  const t = String(s || "").trim();
  return /^[0-9]{6,}$/.test(t);
}

function sanitizeSku(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

function autoSkuFromBarcodeOrTime(barcodeOrAnything) {
  const b = String(barcodeOrAnything || "").trim();

  if (isLikelyBarcode(b)) return sanitizeSku("SKU-" + b);

  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  return sanitizeSku(`SKU-${yy}${mm}${dd}-${hh}${mi}${ss}`);
}

function getScanMode() {
  return (scanModeEl?.value || "auto").toLowerCase();
}

function getScanDelayMs() {
  const n = Number(scanDelayEl?.value || 120);
  if (!Number.isFinite(n)) return 120;
  return Math.max(80, n);
}

function acceptedFormatsForMode(mode) {
  if (mode === "barcode") {
    return [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.ITF
    ];
  }

  if (mode === "qr") {
    return [ZXing.BarcodeFormat.QR_CODE];
  }

  return [
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.QR_CODE
  ];
}

function showLogin(msg) {
  try { stopScan(); } catch (_) {}
  appView.style.display = "none";
  loginView.style.display = "block";
  setStatus(loginStatusEl, msg || "Enter PIN to continue.", "muted");
  setTimeout(() => {
    try { pinEl.focus(); pinEl.select(); } catch (_) {}
  }, 30);
}

function showApp() {
  loginView.style.display = "none";
  appView.style.display = "block";
}

/* =========================
   API
========================= */

async function apiGet(path, params = {}) {
  const url = new URL(path, WEB_APP_URL);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function apiPost(action, payload = {}) {
  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (data && data.ok === false && data.error) throw new Error(data.error);
  return data;
}

function gsRunRaw(fnName, ...args) {
  if (window.google && google.script && google.script.run) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)[fnName](...args);
    });
  }

  if (fnName === "loginWithPin") {
    return apiPost("loginWithPin", { pin: args[0] });
  }

  if (fnName === "verifySession") {
    return apiPost("verifySession", { token: args[0] });
  }

  throw new Error(`Unsupported raw call: ${fnName}`);
}

function gsRun(fnName, ...args) {
  if (!SESSION_TOKEN) return Promise.reject(new Error("Not logged in"));

  if (window.google && google.script && google.script.run) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)[fnName](SESSION_TOKEN, ...args);
    });
  }

  return apiPost(fnName, { token: SESSION_TOKEN, args });
}

/* =========================
   LOGIN
========================= */

async function doLogin() {
  const pin = String(pinEl.value || "").trim();
  if (!/^\d{4}$/.test(pin)) {
    setStatus(loginStatusEl, "PIN must be 4 digits.", "err");
    return;
  }

  setStatus(loginStatusEl, "Logging in…", "muted");
  btnLogin.disabled = true;

  try {
    const r = await gsRunRaw("loginWithPin", pin);
    if (r && r.ok && r.token) {
      SESSION_TOKEN = r.token;
      localStorage.setItem("inv_session_token", SESSION_TOKEN);
      setStatus(loginStatusEl, "Logged in ✅", "ok");
      showApp();
      showPage("scan");
    } else {
      setStatus(loginStatusEl, "Login failed.", "err");
    }
  } catch (e) {
    setStatus(loginStatusEl, e?.message || String(e), "err");
  } finally {
    btnLogin.disabled = false;
  }
}

btnLogin.addEventListener("click", doLogin);
btnClearPin.addEventListener("click", () => {
  pinEl.value = "";
  setStatus(loginStatusEl, "", "muted");
  try { pinEl.focus(); } catch (_) {}
});
pinEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

/* =========================
   NAV
========================= */

function showPage(page) {
  const p = (page || "scan").toLowerCase();
  const scanOn = p === "scan";
  const lowOn = p === "low";
  const invOn = p === "inv";

  scanView.style.display = scanOn ? "block" : "none";
  lowView.style.display = lowOn ? "block" : "none";
  invView.style.display = invOn ? "block" : "none";

  tabScan.classList.toggle("active", scanOn);
  tabLow.classList.toggle("active", lowOn);
  tabInv.classList.toggle("active", invOn);

  if (!scanOn) stopScan();
  if (lowOn) doLowRefresh();
  if (invOn) doInvRefresh();
}

tabScan.addEventListener("click", () => showPage("scan"));
tabLow.addEventListener("click", () => showPage("low"));
tabInv.addEventListener("click", () => showPage("inv"));

/* =========================
   IMAGE HELPERS
========================= */

async function tryLoadImageFallback_(sku, target) {
  const cleanSku = String(sku || "").trim();
  if (!cleanSku) return false;

  try {
    const r = await gsRun("getProductImageData", cleanSku);
    if (!r || !r.ok || !r.found || !r.base64) return false;

    const mime = r.mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${r.base64}`;

    if (target === "EDIT") {
      editImg.src = dataUrl;
      editImg.style.display = "block";
      editImgEmpty.style.display = "none";
    } else {
      productImg.src = dataUrl;
      productImg.style.display = "block";
      productImgEmpty.style.display = "none";
    }
    return true;
  } catch (_) {
    return false;
  }
}

function renderImageForProduct(p) {
  const url = (p && p.imageUrl) ? String(p.imageUrl).trim() : "";

  productImg.onerror = null;
  editImg.onerror = null;

  if (url) {
    const u = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();

    productImg.onerror = async () => {
      productImg.removeAttribute("src");
      productImg.style.display = "none";
      productImgEmpty.style.display = "block";
      await tryLoadImageFallback_(p.sku, "PRODUCT");
    };
    productImg.src = u;
    productImg.style.display = "block";
    productImgEmpty.style.display = "none";

    editImg.onerror = async () => {
      editImg.removeAttribute("src");
      editImg.style.display = "none";
      editImgEmpty.style.display = "block";
      await tryLoadImageFallback_(p.sku, "EDIT");
    };
    editImg.src = u;
    editImg.style.display = "block";
    editImgEmpty.style.display = "none";
  } else {
    productImg.removeAttribute("src");
    productImg.style.display = "none";
    productImgEmpty.style.display = "block";

    editImg.removeAttribute("src");
    editImg.style.display = "none";
    editImgEmpty.style.display = "block";
  }
}

/* =========================
   PRODUCT UI
========================= */

function renderProduct(p) {
  renderImageForProduct(p);

  productBoxEl.innerHTML = `
    <table>
      <tr><td>SKU</td><td><b>${escapeHtml(p.sku)}</b></td></tr>
      <tr><td>Barcode</td><td>${escapeHtml(p.barcode || "")}</td></tr>
      <tr><td>Name</td><td>${escapeHtml(p.name || "")}</td></tr>
      <tr><td>Location</td><td>${escapeHtml(p.location || "")}</td></tr>
      <tr><td>On Hand</td><td><b>${Number(p.qtyOnHand || 0)}</b></td></tr>
      <tr><td>Min Qty</td><td>${Number(p.minQty || 0)}</td></tr>
    </table>
  `;

  btnIn.disabled = false;
  btnOut.disabled = false;
  btnEdit.disabled = false;
  btnAddImage.disabled = false;
  btnCreate.style.display = "none";
  createCard.style.display = "none";
  editCard.style.display = "none";
}

function resetProductUI() {
  currentProduct = null;
  productBoxEl.textContent = "No product loaded.";
  btnIn.disabled = true;
  btnOut.disabled = true;
  btnEdit.disabled = true;
  btnAddImage.disabled = true;
  btnCreate.style.display = "none";
  createCard.style.display = "none";
  editCard.style.display = "none";
  setStatus(moveStatusEl, "", "muted");
  setStatus(editStatusEl, "", "muted");
  renderImageForProduct(null);
}

function getQtyOrThrow() {
  const q = Number(qtyEl.value);
  if (!Number.isFinite(q) || q <= 0) throw new Error("Enter a quantity > 0");
  if (!Number.isInteger(q)) throw new Error("Quantity must be a whole number");
  return q;
}

/* =========================
   LOOKUP / CREATE / EDIT
========================= */

async function doLookup() {
  const code = codeEl.value.trim();
  if (!code) {
    setStatus(lookupStatusEl, "Scan or enter a code first.", "err");
    resetProductUI();
    return;
  }

  setStatus(lookupStatusEl, "Looking up…", "muted");
  resetProductUI();

  try {
    const r = await gsRun("lookupCode", code);
    if (!r || !r.found) {
      setStatus(lookupStatusEl, "Not found. Tap \"Create Product\".", "err");
      btnCreate.style.display = "block";
      return;
    }

    currentProduct = r;
    renderProduct(r);

    if (!code.startsWith("INV:") && r.sku) codeEl.value = "INV:" + r.sku;
    setStatus(lookupStatusEl, `Found: ${r.sku}`, "ok");
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not logged in|session expired/i.test(msg)) {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
      return;
    }
    setStatus(lookupStatusEl, msg, "err");
  }
}

function openCreateFromCodeBox() {
  const codeNow = (codeEl.value || "").trim();
  if (!codeNow) {
    setStatus(lookupStatusEl, "Scan or type a code first.", "err");
    return;
  }

  const hasInvSku = codeNow.startsWith("INV:");
  const invSku = hasInvSku ? codeNow.slice(4).trim() : "";

  const scannedBarcode = isLikelyBarcode(codeNow) ? codeNow : "";
  cBarcode.value = scannedBarcode;

  if (invSku && /^[A-Za-z0-9-]+$/.test(invSku)) cSku.value = invSku;
  else cSku.value = autoSkuFromBarcodeOrTime(scannedBarcode || codeNow);

  if (!cSku.value.trim()) cSku.value = autoSkuFromBarcodeOrTime(scannedBarcode || codeNow);

  cName.value = "";
  cLocation.value = "";
  cQty.value = "";
  cMin.value = "";
  cNotes.value = "";

  createCard.style.display = "block";
  editCard.style.display = "none";
  setStatus(createStatusEl, "Enter Name (required). SKU auto-filled.", "muted");
  setStatus(lookupStatusEl, "Create form opened ↓", "ok");

  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function saveCreate() {
  const product = {
    sku: cSku.value.trim(),
    barcode: cBarcode.value.trim(),
    name: cName.value.trim(),
    location: cLocation.value.trim(),
    qtyOnHand: cQty.value === "" ? 0 : Number(cQty.value),
    minQty: cMin.value === "" ? 0 : Number(cMin.value),
    notes: cNotes.value.trim()
  };

  if (!product.sku) { setStatus(createStatusEl, "SKU is required", "err"); return; }
  if (!/^[A-Za-z0-9-]+$/.test(product.sku)) { setStatus(createStatusEl, "SKU format: letters/numbers/hyphen only", "err"); return; }
  if (!product.name) { setStatus(createStatusEl, "Name is required", "err"); return; }
  if (!Number.isFinite(product.qtyOnHand) || product.qtyOnHand < 0) { setStatus(createStatusEl, "Starting Qty must be >= 0", "err"); return; }
  if (!Number.isFinite(product.minQty) || product.minQty < 0) { setStatus(createStatusEl, "Min Qty must be >= 0", "err"); return; }

  setStatus(createStatusEl, "Saving…", "muted");

  try {
    const r = await gsRun("createProduct", product);
    setStatus(createStatusEl, `Saved ✅ ${r.sku}`, "ok");
    codeEl.value = "INV:" + product.sku;
    await doLookup();
    createCard.style.display = "none";
    btnCreate.style.display = "none";
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not logged in|session expired/i.test(msg)) {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
      return;
    }
    setStatus(createStatusEl, msg, "err");
  }
}

function openEditProduct() {
  if (!currentProduct) return;

  eSku.value = currentProduct.sku || "";
  eBarcode.value = currentProduct.barcode || "";
  eName.value = currentProduct.name || "";
  eLocation.value = currentProduct.location || "";
  eMin.value = String(Number(currentProduct.minQty || 0));
  eNotes.value = currentProduct.notes || "";

  renderImageForProduct(currentProduct);

  editCard.style.display = "block";
  createCard.style.display = "none";
  setStatus(editStatusEl, "Tap \"Scan into Barcode\" or type it, then Save.", "muted");

  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  setTimeout(() => {
    try { eBarcode.focus(); eBarcode.select(); } catch (_) {}
  }, 50);
}

async function saveEditProduct() {
  const payload = {
    sku: eSku.value.trim(),
    barcode: eBarcode.value.trim(),
    name: eName.value.trim(),
    location: eLocation.value.trim(),
    minQty: eMin.value === "" ? 0 : Number(eMin.value),
    notes: eNotes.value.trim()
  };

  if (!payload.sku) { setStatus(editStatusEl, "SKU missing", "err"); return; }
  if (!payload.name) { setStatus(editStatusEl, "Name is required", "err"); return; }
  if (!Number.isFinite(payload.minQty) || payload.minQty < 0) { setStatus(editStatusEl, "Min Qty must be >= 0", "err"); return; }

  setStatus(editStatusEl, "Saving…", "muted");

  try {
    const r = await gsRun("updateProduct", payload);
    if (r && r.ok && r.found) {
      currentProduct = r;
      renderProduct(r);
      setStatus(editStatusEl, "Saved ✅", "ok");
      codeEl.value = "INV:" + r.sku;
      editCard.style.display = "none";
    } else {
      setStatus(editStatusEl, "Save failed.", "err");
    }
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not logged in|session expired/i.test(msg)) {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
      return;
    }
    setStatus(editStatusEl, msg, "err");
  }
}

async function doMove(type) {
  if (!currentProduct) {
    setStatus(moveStatusEl, "Lookup a product first.", "err");
    return;
  }

  let qty;
  try {
    qty = getQtyOrThrow();
  } catch (e) {
    setStatus(moveStatusEl, e.message, "err");
    return;
  }

  const ref = refEl.value.trim();
  const note = noteEl.value.trim();
  const skuShown = currentProduct.sku;
  const currentOnHand = Number(currentProduct.qtyOnHand || 0);

  const msg =
    type === "IN"
      ? `Confirm BOOK IN\n\nSKU: ${skuShown}\nQty: ${qty}\nCurrent: ${currentOnHand}\nNew: ${currentOnHand + qty}`
      : `Confirm BOOK OUT\n\nSKU: ${skuShown}\nQty: ${qty}\nCurrent: ${currentOnHand}\nNew: ${currentOnHand - qty}`;

  if (!confirm(msg + `\n\nRef: ${ref || "-"}\nNote: ${note || "-"}`)) return;

  setStatus(moveStatusEl, "Saving…", "muted");

  try {
    const r = await gsRun("applyMovement", codeEl.value.trim(), type, qty, ref, note);
    setStatus(moveStatusEl, `Saved ✅ New on-hand: ${r.current}`, "ok");

    const refreshed = await gsRun("lookupCode", skuShown);
    if (refreshed && refreshed.found) {
      currentProduct = refreshed;
      renderProduct(refreshed);
      codeEl.value = "INV:" + refreshed.sku;
    }

    qtyEl.value = "";
    refEl.value = "";
    noteEl.value = "";
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not logged in|session expired/i.test(msg)) {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
      return;
    }
    setStatus(moveStatusEl, msg, "err");
  }
}

/* =========================
   CAMERA
========================= */

async function initTorchCapability() {
  torchCapable = false;
  torchOn = false;
  btnTorch.disabled = true;
  btnTorch.textContent = "Flash: OFF";

  try {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const caps = (track.getCapabilities && track.getCapabilities()) || {};
    torchCapable = !!caps.torch;
    btnTorch.disabled = !torchCapable;
  } catch (_) {}
}

async function toggleTorch() {
  try {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const caps = (track.getCapabilities && track.getCapabilities()) || {};
    if (!caps.torch) return;

    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    btnTorch.textContent = torchOn ? "Flash: ON" : "Flash: OFF";
  } catch (_) {
    setStatus(scanStatusEl, "Flash not supported here.", "err");
    torchOn = false;
    btnTorch.textContent = "Flash: OFF";
  }
}

async function processScannedText_(clean) {
  if (!clean) return false;

  if (scanTarget === "EDIT_BARCODE") {
    if (clean.startsWith("INV:")) {
      setStatus(scanStatusEl, "That was a QR label. Scan the supplier BARCODE instead.", "err");
    } else {
      eBarcode.value = clean;
      setStatus(editStatusEl, "Barcode captured ✅ (now Save Changes)", "ok");
      setStatus(scanStatusEl, "Captured into Edit Barcode field.", "ok");
      scanTarget = "DEFAULT";
      stopScan();
      setTimeout(() => {
        try { eBarcode.focus(); eBarcode.select(); } catch (_) {}
      }, 50);
    }
    return true;
  }

  if (clean.startsWith("INV:")) {
    codeEl.value = clean;
    setStatus(scanStatusEl, `Scanned QR: ${clean}`, "ok");
    stopScan();
    await doLookup();
    return true;
  }

  setStatus(scanStatusEl, "Barcode scanned (matching…)", "muted");
  stopScan();

  try {
    const r = await gsRun("lookupCode", clean);

    if (r && r.found && r.sku) {
      codeEl.value = "INV:" + r.sku;
      currentProduct = r;
      renderProduct(r);
      setStatus(scanStatusEl, `Matched ✅ SKU: ${r.sku}`, "ok");
      setStatus(lookupStatusEl, `Found: ${r.sku}`, "ok");
      return true;
    }

    btnCreate.style.display = "block";
    createCard.style.display = "block";
    editCard.style.display = "none";

    cBarcode.value = clean;
    cSku.value = autoSkuFromBarcodeOrTime(clean);
    cName.value = "";
    cLocation.value = "";
    cQty.value = "";
    cMin.value = "";
    cNotes.value = "";

    setStatus(createStatusEl, "Enter Name (required). SKU auto-filled.", "muted");
    setStatus(scanStatusEl, "Barcode not linked. Create product to link it.", "err");
    return true;
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not logged in|session expired/i.test(msg)) {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
      return true;
    }
    setStatus(scanStatusEl, msg, "err");
    return true;
  }
}

async function handleScanValue(val) {
  const clean = String(val || "").trim();
  if (!clean) return false;
  if (scanLock) return false;
  if (clean === lastScanVal) return false;

  const now = Date.now();
  const minDelay = getScanDelayMs();
  if (now - lastScanAt < minDelay) return false;

  scanLock = true;
  lastScanVal = clean;
  lastScanAt = now;

  try {
    return await processScannedText_(clean);
  } finally {
    setTimeout(() => { scanLock = false; }, minDelay);
  }
}

async function hardResetCamera_() {
  try {
    if (rafId) cancelAnimationFrame(rafId);
  } catch (_) {}
  rafId = null;

  zxingRunning = false;
  try { if (zxingReader) zxingReader.reset(); } catch (_) {}
  zxingReader = null;

  try {
    if (stream) {
      stream.getTracks().forEach(t => {
        try { t.stop(); } catch (_) {}
      });
    }
  } catch (_) {}

  stream = null;

  try { videoEl.pause(); } catch (_) {}
  try { videoEl.srcObject = null; } catch (_) {}
  try { videoEl.removeAttribute("src"); } catch (_) {}
  try { videoEl.load(); } catch (_) {}

  scanning = false;
  scannerWrap.classList.remove("scannerOn");
  btnStart.disabled = false;
  btnStop.disabled = true;

  torchOn = false;
  torchCapable = false;
  btnTorch.disabled = true;
  btnTorch.textContent = "Flash: OFF";
}

async function startScan() {
  if (scanning) return;

  if (typeof jsQR !== "function") {
    setStatus(scanStatusEl, "jsQR not loaded. Check script include.", "err");
    return;
  }

  setStatus(scanStatusEl, "Starting camera…", "muted");
  scanDebugEl.textContent = "";

  await hardResetCamera_();

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("This browser does not support live camera access.");
    }

    let liveStream = null;

    try {
      liveStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });
    } catch (e1) {
      liveStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }

    stream = liveStream;
    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "true");
    videoEl.setAttribute("autoplay", "true");
    videoEl.setAttribute("muted", "true");
    videoEl.muted = true;

    await new Promise((resolve) => setTimeout(resolve, 150));
    await videoEl.play();

    await new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        if ((videoEl.videoWidth || 0) > 0 && (videoEl.videoHeight || 0) > 0) {
          clearInterval(timer);
          resolve();
        } else if (tries > 30) {
          clearInterval(timer);
          reject(new Error("Camera started but video did not become ready."));
        }
      }, 100);
    });

    scanning = true;
    scannerWrap.classList.add("scannerOn");
    btnStart.disabled = true;
    btnStop.disabled = false;

    scanLock = false;
    lastScanVal = "";
    lastScanAt = 0;

    const mode = getScanMode();
    setStatus(
      scanStatusEl,
      scanTarget === "EDIT_BARCODE"
        ? `Scanning… (next scan will fill Edit Barcode) [${mode}]`
        : `Scanning… [${mode}]`,
      "muted"
    );

    await initTorchCapability();

    try {
      if (window.ZXing && ZXing.BrowserMultiFormatReader) {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, false);
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, acceptedFormatsForMode(mode));

        zxingReader = new ZXing.BrowserMultiFormatReader(hints, 30);
        zxingRunning = true;

        zxingReader.decodeFromVideoElementContinuously(videoEl, (result) => {
          if (!scanning || !zxingRunning) return;
          if (result && result.getText) handleScanValue(result.getText());
        });
      }
    } catch (_) {
      zxingRunning = false;
      zxingReader = null;
    }

    let frameCount = 0;
    const loop = () => {
      if (!scanning) return;

      const w = videoEl.videoWidth || 0;
      const h = videoEl.videoHeight || 0;
      const modeNow = getScanMode();

      frameCount++;
      if (frameCount % 30 === 0) {
        scanDebugEl.textContent = `frames=${frameCount} video=${w}x${h} mode=${modeNow} delay=${getScanDelayMs()}ms`;
      }

      if (frameCount % 4 === 0 && w && h) {
        const scale = modeNow === "barcode" ? 0.75 : 0.65;
        canvas.width = Math.floor(w * scale);
        canvas.height = Math.floor(h * scale);

        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let result = null;

        if (modeNow === "qr") {
          result = jsQR(img.data, img.width, img.height);
        } else if (modeNow === "auto") {
          result = jsQR(img.data, img.width, img.height);
        }

        if (result && result.data) {
          handleScanValue(result.data);
          return;
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

  } catch (e) {
    const name = e?.name || "";
    const msg = e?.message || String(e);

    await hardResetCamera_();

    if (/NotAllowedError|PermissionDeniedError/i.test(name + " " + msg)) {
      setStatus(scanStatusEl, "Camera permission was denied or blocked.", "err");
    } else if (/NotReadableError|TrackStartError/i.test(name + " " + msg)) {
      setStatus(scanStatusEl, "Camera is busy or could not start. Close other camera apps/tabs and try again.", "err");
    } else if (/NotFoundError|DevicesNotFoundError/i.test(name + " " + msg)) {
      setStatus(scanStatusEl, "No camera found on this device.", "err");
    } else {
      setStatus(scanStatusEl, msg, "err");
    }

    scanDebugEl.textContent = `camera_error=${name || "Error"} ${msg}`;
  }
}

function stopScan() {
  hardResetCamera_();
  setStatus(scanStatusEl, "Camera stopped.", "muted");
}

/* =========================
   LOW STOCK
========================= */

function renderLowStock(items) {
  if (!items || !items.length) {
    lowList.innerHTML = "";
    setStatus(lowStatus, "No items are at/below Min Qty ✅", "ok");
    return;
  }

  lowList.innerHTML = items.map(it => {
    const qty = Number(it.qtyOnHand || 0);
    const min = Number(it.minQty || 0);
    const delta = qty - min;
    const deltaText = delta <= 0 ? `Δ ${delta}` : `Δ +${delta}`;

    const name = (it.name && String(it.name).trim()) ? String(it.name).trim() : "Unnamed Product";
    const sku = String(it.sku || "").trim();

    return `
      <div class="listItem" data-sku="${escapeHtml(sku)}">
        <div class="liTop">
          <div class="liSku">${escapeHtml(name)} ⚠️</div>
          <div class="liDelta">${escapeHtml(deltaText)}</div>
        </div>
        <div class="liMeta">SKU: ${escapeHtml(sku)}</div>
        <div class="liMeta">
          Loc: ${escapeHtml(it.location || "-")} •
          On hand: ${qty} •
          Min: ${min}
        </div>
      </div>
    `;
  }).join("");

  setStatus(lowStatus, `Showing ${items.length} item(s). Tap one to open.`, "ok");
}

async function doLowRefresh() {
  setStatus(lowStatus, "Loading…", "muted");
  lowList.innerHTML = "";
  try {
    const rows = await gsRun("getLowStockItems");
    renderLowStock(rows || []);
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not logged in|session expired/i.test(msg)) {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
      return;
    }
    setStatus(lowStatus, msg, "err");
  }
}

/* =========================
   INVENTORY
========================= */

function renderInventory(items) {
  if (!items || !items.length) {
    invList.innerHTML = "";
    setStatus(invStatus, "No matching items.", "muted");
    return;
  }

  invList.innerHTML = items.map(it => {
    const qty = Number(it.qtyOnHand || 0);
    const min = Number(it.minQty || 0);
    const isLow = (min > 0 && qty <= min);
    const warn = isLow ? " ⚠️" : "";

    const name = (it.name && String(it.name).trim()) ? String(it.name).trim() : "Unnamed Product";
    const sku = String(it.sku || "").trim();

    return `
      <div class="listItem" data-sku="${escapeHtml(sku)}">
        <div class="liTop">
          <div class="liSku">${escapeHtml(name)}${warn}</div>
          <div class="liDelta">On: ${qty}</div>
        </div>
        <div class="liMeta">SKU: ${escapeHtml(sku)}</div>
        <div class="liMeta">Loc: ${escapeHtml(it.location || "-")} • Min: ${min} • Barcode: ${escapeHtml(it.barcode || "-")}</div>
      </div>
    `;
  }).join("");

  setStatus(invStatus, `Showing ${items.length} item(s). Tap one to open.`, "ok");
}

async function doInvRefresh() {
  const q = (invSearch.value || "").trim();
  setStatus(invStatus, "Loading…", "muted");
  invList.innerHTML = "";

  try {
    const rows = await gsRun("listInventory", q);
    renderInventory(rows || []);
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not logged in|session expired/i.test(msg)) {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
      return;
    }
    setStatus(invStatus, msg, "err");
  }
}

/* =========================
   IMAGE UPLOAD
========================= */

function openImagePicker(target) {
  if (!currentProduct || !currentProduct.sku) return;
  imgTarget = target || "PRODUCT";
  imgPicker.value = "";
  imgPicker.click();
}

function readFileAsDataURL_(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Failed to read image"));
    fr.readAsDataURL(file);
  });
}

function loadImage_(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

async function compressImageDataUrl_(dataUrl, maxSide, quality) {
  const img = await loadImage_(dataUrl);
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;

  const m = Math.max(w0, h0) || 1;
  const scale = Math.min(1, (maxSide || 1200) / m);

  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;

  const g = c.getContext("2d");
  g.drawImage(img, 0, 0, w, h);

  const outMime = "image/jpeg";
  const q = (typeof quality === "number") ? quality : 0.82;
  const outDataUrl = c.toDataURL(outMime, q);

  const parts = String(outDataUrl).split(",");
  const base64 = parts.length > 1 ? parts[1] : "";
  return { base64, mimeType: outMime };
}

/* =========================
   EVENTS
========================= */

btnStart.addEventListener("click", () => {
  scanTarget = "DEFAULT";
  startScan();
});
btnStop.addEventListener("click", stopScan);
btnTorch.addEventListener("click", toggleTorch);

btnLookup.addEventListener("click", doLookup);
btnEdit.addEventListener("click", openEditProduct);

btnCreate.addEventListener("click", openCreateFromCodeBox);
btnSaveCreate.addEventListener("click", saveCreate);
btnCancelCreate.addEventListener("click", () => {
  createCard.style.display = "none";
  setStatus(createStatusEl, "", "muted");
});

btnSaveEdit.addEventListener("click", saveEditProduct);
btnCancelEdit.addEventListener("click", () => {
  editCard.style.display = "none";
  setStatus(editStatusEl, "", "muted");
  if (scanTarget === "EDIT_BARCODE") scanTarget = "DEFAULT";
});

btnScanEditBarcode.addEventListener("click", async () => {
  if (!editCard || editCard.style.display === "none") {
    setStatus(editStatusEl, "Open Edit Product first.", "err");
    return;
  }
  scanTarget = "EDIT_BARCODE";
  setStatus(editStatusEl, "Scanner armed: scan supplier BARCODE now…", "muted");
  window.scrollTo({ top: 0, behavior: "smooth" });
  await startScan();
});

btnClear.addEventListener("click", () => {
  codeEl.value = "";
  qtyEl.value = "";
  refEl.value = "";
  noteEl.value = "";
  setStatus(lookupStatusEl, "", "muted");
  setStatus(moveStatusEl, "", "muted");
  resetProductUI();
  setStatus(scanStatusEl, "Camera idle.", "muted");
  scanDebugEl.textContent = "";
  scanTarget = "DEFAULT";
});

btnIn.addEventListener("click", () => doMove("IN"));
btnOut.addEventListener("click", () => doMove("OUT"));

btnLowRefresh.addEventListener("click", doLowRefresh);
lowList.addEventListener("click", async (ev) => {
  const el = ev.target.closest(".listItem");
  if (!el) return;
  const sku = el.getAttribute("data-sku");
  if (!sku) return;

  showPage("scan");
  codeEl.value = "INV:" + sku;
  await doLookup();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

btnInvRefresh.addEventListener("click", doInvRefresh);
invSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doInvRefresh();
});
invList.addEventListener("click", async (ev) => {
  const el = ev.target.closest(".listItem");
  if (!el) return;
  const sku = el.getAttribute("data-sku");
  if (!sku) return;

  showPage("scan");
  codeEl.value = "INV:" + sku;
  await doLookup();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

btnAddImage.addEventListener("click", () => openImagePicker("PRODUCT"));
btnAddImageEdit.addEventListener("click", () => openImagePicker("EDIT"));

imgPicker.addEventListener("change", async () => {
  try {
    if (!currentProduct || !currentProduct.sku) return;
    const file = imgPicker.files && imgPicker.files[0];
    if (!file) return;

    const statusEl = (imgTarget === "EDIT") ? editStatusEl : moveStatusEl;
    setStatus(statusEl, "Uploading image…", "muted");

    const dataUrl = await readFileAsDataURL_(file);
    const { base64, mimeType } = await compressImageDataUrl_(dataUrl, 1200, 0.82);

    const r = await gsRun("uploadProductImage", currentProduct.sku, base64, mimeType);

    if (r && r.ok && r.imageUrl) {
      currentProduct.imageUrl = r.imageUrl;

      renderImageForProduct(currentProduct);
      await tryLoadImageFallback_(currentProduct.sku, (imgTarget === "EDIT") ? "EDIT" : "PRODUCT");

      setStatus(statusEl, "Image saved ✅", "ok");

      try {
        const refreshed = await gsRun("lookupCode", "INV:" + currentProduct.sku);
        if (refreshed && refreshed.found) {
          currentProduct = refreshed;
          renderProduct(refreshed);
        }
      } catch (_) {}
    } else {
      setStatus(statusEl, "Upload failed.", "err");
    }
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not logged in|session expired/i.test(msg)) {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
      return;
    }
    const statusEl = (imgTarget === "EDIT") ? editStatusEl : moveStatusEl;
    setStatus(statusEl, msg, "err");
  }
});

/* =========================
   BOOT
========================= */

(async function boot() {
  if (SESSION_TOKEN) {
    try {
      let valid = null;

      if (window.google && google.script && google.script.run) {
        valid = await gsRunRaw("verifySession", SESSION_TOKEN);
      } else {
        valid = await apiPost("verifySession", { token: SESSION_TOKEN });
      }

      if (valid && valid.ok) {
        showApp();
        showPage(INITIAL_PAGE);
        return;
      }
    } catch (_) {}
    SESSION_TOKEN = "";
    localStorage.removeItem("inv_session_token");
  }

  showLogin("");
})();
