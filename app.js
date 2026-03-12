const API_URL = "YOUR_APPS_SCRIPT_WEB_APP_URL";
let SESSION_TOKEN = localStorage.getItem("inv_session_token") || "";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const pinEl = document.getElementById("pin");
const btnLogin = document.getElementById("btnLogin");
const btnClearPin = document.getElementById("btnClearPin");
const loginStatus = document.getElementById("loginStatus");

const videoEl = document.getElementById("video");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const scanStatus = document.getElementById("scanStatus");

let stream = null;

function showLogin(msg = "") {
  loginView.style.display = "block";
  appView.style.display = "none";
  loginStatus.textContent = msg;
}

function showApp() {
  loginView.style.display = "none";
  appView.style.display = "block";
}

async function api(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      token: SESSION_TOKEN,
      ...payload
    })
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function doLogin() {
  const pin = String(pinEl.value || "").trim();
  if (!/^\d{4}$/.test(pin)) {
    loginStatus.textContent = "PIN must be 4 digits.";
    return;
  }

  loginStatus.textContent = "Logging in…";

  try {
    const data = await api("login", { pin });
    SESSION_TOKEN = data.token;
    localStorage.setItem("inv_session_token", SESSION_TOKEN);
    showApp();
  } catch (err) {
    loginStatus.textContent = err.message;
  }
}

async function startCamera() {
  try {
    scanStatus.textContent = "Starting camera…";

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    videoEl.srcObject = stream;
    await videoEl.play();

    btnStart.disabled = true;
    btnStop.disabled = false;
    scanStatus.textContent = "Camera running.";
  } catch (err) {
    scanStatus.textContent = err.message || "Camera failed.";
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  videoEl.srcObject = null;
  btnStart.disabled = false;
  btnStop.disabled = true;
  scanStatus.textContent = "Camera stopped.";
}

btnLogin.addEventListener("click", doLogin);
btnClearPin.addEventListener("click", () => {
  pinEl.value = "";
  loginStatus.textContent = "";
});

btnStart.addEventListener("click", startCamera);
btnStop.addEventListener("click", stopCamera);

if (SESSION_TOKEN) {
  showApp();
} else {
  showLogin();
}
