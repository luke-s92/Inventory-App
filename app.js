const API_URL = "https://script.google.com/macros/s/AKfycbxNvby0oATUZBVxg9VcrlzaQyU3LLG2YYS_0z43HMEIz3THf2s-m8TVOGcUvPe9QpkRtg/exec";
const INITIAL_PAGE = "scan";

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let SESSION_TOKEN = localStorage.getItem("inv_session_token") || "";

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
const btnStop  = document.getElementById("btnStop");
const btnTorch = document.getElementById("btnTorch");
const btnLookup = document.getElementById("btnLookup");
const btnClear = document.getElementById("btnClear");
const btnIn = document.getElementById("btnIn");
const btnOut = document.getElementById("btnOut");
const btnCreate = document.getElementById("btnCreate");
const btnEdit = document.getElementById("btnEdit");

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

let imgTarget = "PRODUCT";
let stream = null;
let scanning = false;
let rafId = null;
let zxingReader = null;
let zxingRunning = false;
let scanLock = false;
let lastScanVal = "";
let torchOn = false;
let torchCapable = false;
let currentProduct = null;
let scanTarget = "DEFAULT";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

function setStatus(el, msg, type) {
  if (!el) return;
  el.classList.remove("ok", "err", "muted");
  el.classList.add(type || "muted");
  el.textContent = msg || "";
}

function showLogin(msg) {
  try { stopScan(); } catch (_) {}
  appView.style.display = "none";
  loginView.style.display = "block";
  setStatus(loginStatusEl, msg || "Enter PIN to continue.", "muted");
}

function showApp() {
  loginView.style.display = "none";
  appView.style.display = "block";
}

async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data && data.ok === false && data.error) {
    throw new Error(data.error);
  }
  return data;
}

async function doLogin() {
  const pin = String(pinEl.value || "").trim();
  if (!/^\d{4}$/.test(pin)) {
    setStatus(loginStatusEl, "PIN must be 4 digits.", "err");
    return;
  }

  btnLogin.disabled = true;
  setStatus(loginStatusEl, "Logging in…", "muted");

  try {
    const r = await apiPost({ action: "login", pin });
    if (r && r.ok && r.token) {
      SESSION_TOKEN = r.token;
      localStorage.setItem("inv_session_token", SESSION_TOKEN);
      showApp();
      setStatus(loginStatusEl, "Logged in ✅", "ok");
      showPage("scan");
    } else {
      setStatus(loginStatusEl, "Login failed.", "err");
    }
  } catch (e) {
    setStatus(loginStatusEl, e.message || String(e), "err");
  } finally {
    btnLogin.disabled = false;
  }
}

async function verifySessionOnLoad() {
  if (!SESSION_TOKEN) {
    showLogin("");
    return;
  }

  try {
    const r = await apiPost({ action: "verifySession", token: SESSION_TOKEN });
    if (r && r.ok) {
      showApp();
      showPage("scan");
    } else {
      SESSION_TOKEN = "";
      localStorage.removeItem("inv_session_token");
      showLogin("Session expired. Please log in again.");
    }
  } catch (_) {
    SESSION_TOKEN = "";
    localStorage.removeItem("inv_session_token");
    showLogin("Session expired. Please log in again.");
  }
}

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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function isLikelyBarcode(s) {
  return /^[0-9]{6,}$/.test(String(s || "").trim());
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

async function authCall(action, extra = {}) {
  if (!SESSION_TOKEN) throw new Error("Not logged in");
  return apiPost({ action, token: SESSION_TOKEN, ...extra });
}

function renderImageForProduct(p) {
  const url = p && p.imageUrl ? String(p.imageUrl).trim() : "";

  if (url) {
    const u = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
    productImg.src = u;
    productImg.style.display = "block";
    productImgEmpty.style.display = "none";

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
    const r = await authCall("lookupCode", { scanCode: code });
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
    const msg = e.message || String(e);
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
  cSku.value = invSku && /^[A-Za-z0-9-]+$/.test(invSku)
    ? invSku
    : autoSkuFromBarcodeOrTime(scannedBarcode || codeNow);

  cName.value = "";
  cLocation.value = "";
  cQty.value = "";
  cMin.value = "";
  cNotes.value = "";

  createCard.style.display = "block";
  editCard.style.display = "none";

  setStatus(createStatusEl, "Enter Name (required). SKU auto-filled.", "muted");
  setStatus(lookupStatusEl, "Create form opened ↓", "ok");
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

  if (!product.sku) return setStatus(createStatusEl, "SKU is required", "err");
  if (!/^[A-Za-z0-9-]+$/.test(product.sku)) return setStatus(createStatusEl, "SKU format: letters/numbers/hyphen only", "err");
  if (!product.name) return setStatus(createStatusEl, "Name is required", "err");

  setStatus(createStatusEl, "Saving…", "muted");

  try {
    const r = await authCall("createProduct", { product });
    setStatus(createStatusEl, `Saved ✅ ${r.sku}`, "ok");
    codeEl.value = "INV:" + r.sku;
    createCard.style.display = "none";
    btnCreate.style.display = "none";
    await doLookup();
  } catch (e) {
    setStatus(createStatusEl, e.message || String(e), "err");
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
}

async function saveEditProduct() {
  const product = {
    sku: eSku.value.trim(),
    barcode: eBarcode.value.trim(),
    name: eName.value.trim(),
    location: eLocation.value.trim(),
    minQty: eMin.value === "" ? 0 : Number(eMin.value),
    notes: eNotes.value.trim()
  };

  setStatus(editStatusEl, "Saving…", "muted");

  try {
    const r = await authCall("updateProduct", { product });
    currentProduct = r;
    renderProduct(r);
    codeEl.value = "INV:" + r.sku;
    editCard.style.display = "none";
    setStatus(editStatusEl, "Saved ✅", "ok");
  } catch (e) {
    setStatus(editStatusEl, e.message || String(e), "err");
  }
}

async function doMove(type) {
  if (!currentProduct) return setStatus(moveStatusEl, "Lookup a product first.", "err");

  let qty;
  try {
    qty = getQtyOrThrow();
  } catch (e) {
    return setStatus(moveStatusEl, e.message, "err");
  }

  setStatus(moveStatusEl, "Saving…", "muted");

  try {
    const r = await authCall("applyMovement", {
      scanCode: codeEl.value.trim(),
      type,
      qty,
      ref: refEl.value.trim(),
      note: noteEl.value.trim()
    });

    setStatus(moveStatusEl, `Saved ✅ New on-hand: ${r.current}`, "ok");

    qtyEl.value = "";
    refEl.value = "";
    noteEl.value = "";

    const refreshed = await authCall("lookupCode", { scanCode: currentProduct.sku });
    if (refreshed && refreshed.found) {
      currentProduct = refreshed;
      renderProduct(refreshed);
      codeEl.value = "INV:" + refreshed.sku;
    }
  } catch (e) {
    setStatus(moveStatusEl, e.message || String(e), "err");
  }
}

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

async function processScannedText(clean) {
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
    const r = await authCall("lookupCode", { scanCode: clean });

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
    setStatus(scanStatusEl, e.message || String(e), "err");
    return true;
  }
}

async function handleScanValue(val) {
  const clean = String(val || "").trim();
  if (!clean) return false;
  if (scanLock) return false;
  if (clean === lastScanVal) return false;

  scanLock = true;
  lastScanVal = clean;

  try {
    return await processScannedText(clean);
  } finally {
    setTimeout(() => { scanLock = false; }, 500);
  }
}

async function hardResetCamera() {
  try { if (rafId) cancelAnimationFrame(rafId); } catch (_) {}
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

  await hardResetCamera();

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("This browser does not support live camera access.");
    }

    let liveStream = null;

    try {
      liveStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
    } catch (_) {
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

    await new Promise(resolve => setTimeout(resolve, 150));
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

    setStatus(
      scanStatusEl,
      scanTarget === "EDIT_BARCODE"
        ? "Scanning… (next scan will fill Edit Barcode)"
        : "Scanning…",
      "muted"
    );

    await initTorchCapability();

    try {
      if (window.ZXing && ZXing.BrowserMultiFormatReader) {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, false);
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.ITF,
          ZXing.BarcodeFormat.QR_CODE
        ]);

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

      frameCount++;
      if (frameCount % 30 === 0) {
        scanDebugEl.textContent = `frames=${frameCount} video=${w}x${h}`;
      }

      if (frameCount % 4 === 0 && w && h) {
        const scale = 0.65;
        canvas.width = Math.floor(w * scale);
        canvas.height = Math.floor(h * scale);

        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const result = jsQR(img.data, img.width, img.height);
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

    await hardResetCamera();

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
  hardResetCamera();
  setStatus(scanStatusEl, "Camera stopped.", "muted");
}

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
    const rows = await authCall("getLowStockItems");
    renderLowStock(rows || []);
  } catch (e) {
    setStatus(lowStatus, e.message || String(e), "err");
  }
}

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
    const rows = await authCall("listInventory", { query: q });
    renderInventory(rows || []);
  } catch (e) {
    setStatus(invStatus, e.message || String(e), "err");
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Failed to read image"));
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

async function compressImageDataUrl(dataUrl, maxSide, quality) {
  const img = await loadImage(dataUrl);
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

  const outDataUrl = c.toDataURL("image/jpeg", typeof quality === "number" ? quality : 0.82);
  const parts = String(outDataUrl).split(",");

  return {
    base64: parts.length > 1 ? parts[1] : "",
    mimeType: "image/jpeg"
  };
}

function openImagePicker(target) {
  if (!currentProduct || !currentProduct.sku) return;
  imgTarget = target || "PRODUCT";
  imgPicker.value = "";
  imgPicker.click();
}

btnLogin.addEventListener("click", doLogin);
btnClearPin.addEventListener("click", () => {
  pinEl.value = "";
  setStatus(loginStatusEl, "", "muted");
});

pinEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

tabScan.addEventListener("click", () => showPage("scan"));
tabLow.addEventListener("click", () => showPage("low"));
tabInv.addEventListener("click", () => showPage("inv"));

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
btnInvRefresh.addEventListener("click", doInvRefresh);
invSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doInvRefresh();
});

lowList.addEventListener("click", async (ev) => {
  const el = ev.target.closest(".listItem");
  if (!el) return;
  const sku = el.getAttribute("data-sku");
  if (!sku) return;

  showPage("scan");
  codeEl.value = "INV:" + sku;
  await doLookup();
});

invList.addEventListener("click", async (ev) => {
  const el = ev.target.closest(".listItem");
  if (!el) return;
  const sku = el.getAttribute("data-sku");
  if (!sku) return;

  showPage("scan");
  codeEl.value = "INV:" + sku;
  await doLookup();
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

    const dataUrl = await readFileAsDataURL(file);
    const { base64, mimeType } = await compressImageDataUrl(dataUrl, 1200, 0.82);

    const r = await authCall("uploadProductImage", {
      sku: currentProduct.sku,
      base64Data: base64,
      mimeType
    });

    if (r && r.ok && r.imageUrl) {
      currentProduct.imageUrl = r.imageUrl;
      renderImageForProduct(currentProduct);
      setStatus(statusEl, "Image saved ✅", "ok");
    } else {
      setStatus(statusEl, "Upload failed.", "err");
    }
  } catch (e) {
    setStatus(
      (imgTarget === "EDIT") ? editStatusEl : moveStatusEl,
      e.message || String(e),
      "err"
    );
  }
});

verifySessionOnLoad();
