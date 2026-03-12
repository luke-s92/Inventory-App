(function () {
  if (window.jsQR) return;

  var script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  script.async = false;

  script.onload = function () {
    console.log("jsQR loaded");
  };

  script.onerror = function () {
    console.error("Failed to load jsQR library");
  };

  document.head.appendChild(script);
})();
