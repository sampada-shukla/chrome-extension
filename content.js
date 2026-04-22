const CONFIG = {
  ALERT_COOLDOWN_MS: 1000,
  BLOCK_COOLDOWN_MS: 1000,
  RESCAN_DELAY_MS: 50,
  RESCAN_DELAY_SLOW_MS: 300,
  ALERT_VISIBLE_MS: 2800,
  ALERT_FADE_MS: 220,
};

const ALLOWED_HOSTS = [
  "github.com", "claude.ai", "chatgpt.com",
  "chat.openai.com", "gemini.google.com",
  "intranet.rajlaxmiworld.com", "copilot.microsoft.com", "copilot.github.com",
  "oauth2.googleapis.com", "apis.google.com",
];

function isAllowed() {
  const h = location.hostname;
  return ALLOWED_HOSTS.some(d => h === d || h.endsWith("." + d));
}

if (!isAllowed()) {

  let _alertBox = null;
  let _alertHideTimer = null;
  let _alertLocked = false;
  let _blockLocked = false;

  // ─── ALERT UI ───
  const showAlert = function(main, subText){
    if(_alertLocked) return;
    _alertLocked = true;
    setTimeout(() => { _alertLocked = false; }, CONFIG.ALERT_COOLDOWN_MS);

    if (!_alertBox || !_alertBox.isConnected) {
      _alertBox = document.createElement('div');
      _alertBox.style.cssText = `
        position:fixed;top:24px;left:50%;transform:translateX(-50%);
        z-index:2147483647;background:#b71c1c;color:#fff;
        font-family:Segoe UI,Arial,sans-serif;font-size:14px;
        padding:14px 28px;border-radius:8px;
        box-shadow:0 4px 24px rgba(0,0,0,.5);
        text-align:center;min-width:320px;
        border-left:5px solid #ff1744;
        pointer-events:none;opacity:0;transition:opacity .2s ease;
      `;

      const title = document.createElement('div');
      title.textContent = '🔒 SECURITY ALERT';
      title.style.fontWeight = '600';
      title.style.marginBottom = '6px';

      const mainMsg = document.createElement('div');
      mainMsg.id = '__main__';
      mainMsg.style.fontWeight = '500';

      const sub = document.createElement('div');
      sub.id = '__sub__';
      sub.style.fontSize = '12px';
      sub.style.opacity = '0.85';
      sub.style.marginTop = '4px';

      _alertBox.appendChild(title);
      _alertBox.appendChild(mainMsg);
      _alertBox.appendChild(sub);
    }

    _alertBox.querySelector('#__main__').textContent = main;
    _alertBox.querySelector('#__sub__').textContent = subText || '';

    (document.body || document.documentElement).appendChild(_alertBox);

    requestAnimationFrame(() => _alertBox.style.opacity = '1');

    clearTimeout(_alertHideTimer);
    _alertHideTimer = setTimeout(() => {
      _alertBox.style.opacity = '0';
      setTimeout(() => _alertBox?.remove(), CONFIG.ALERT_FADE_MS);
    }, CONFIG.ALERT_VISIBLE_MS);
  };

  const block = function(e, reason) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if(_blockLocked) return;
    _blockLocked = true;
    setTimeout(() => { _blockLocked = false; }, CONFIG.BLOCK_COOLDOWN_MS);

    showAlert("Upload is not permitted.", reason);
  };

  // ─── HARD BLOCK INPUT ───
  const hardBlockInput = function(input) {
    input.disabled = true;
    input.style.display = 'none';
    input.style.pointerEvents = 'none';
    input.setAttribute('data-blocked', '1');

    Object.defineProperty(input, 'files', {
      get: () => [],
      configurable: false
    });
  };

  // ─── INTERCEPT INPUT CREATION ───
  const _createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    const el = _createElement(tag);
    if (tag === 'input') {
      Object.defineProperty(el, 'type', {
        set(val) {
          el.setAttribute('type', val);
          if (val === 'file') hardBlockInput(el);
        },
        get() { return el.getAttribute('type') || ''; }
      });
    }
    return el;
  };

  // ─── CLICK BLOCK ───
  document.addEventListener("click", (e) => {
    const el = e.target.closest('input[type="file"], label, button, a, [role="button"], div, li');
    if (!el) return;

    const input =
      el.tagName === "INPUT" ? el :
      el.tagName === "LABEL"
        ? document.getElementById(el.getAttribute("for")) || el.querySelector('input[type="file"]')
        : el.querySelector?.('input[type="file"]');

    if (input?.type === "file") {
      const isFolder = input.webkitdirectory || input.hasAttribute('webkitdirectory');
      return block(e, isFolder
        ? "Folder upload is not permitted."
        : "File upload is not permitted."
      );
    }

    setTimeout(disableFileInputs, CONFIG.RESCAN_DELAY_MS);
    setTimeout(disableFileInputs, CONFIG.RESCAN_DELAY_SLOW_MS);
  }, true);

  // ─── PROGRAMMATIC CLICK ───
  const _click = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type === "file") {
      showAlert("Upload is not permitted.", "File upload is not permitted.");
      return;
    }
    return _click.apply(this, arguments);
  };

  // ─── CHANGE (BEST FOLDER DETECTION) ───
  document.addEventListener("change", (e) => {
    const input = e.target;

    if (input.type === "file" && input.files?.length) {

      let isFolder = false;

      // 🔥 Reliable detection
      for (const file of input.files) {
        if (file.webkitRelativePath && file.webkitRelativePath !== "") {
          isFolder = true;
          break;
        }
      }

      // fallback
      if (!isFolder && input.hasAttribute('webkitdirectory')) {
        isFolder = true;
      }

      input.value = "";

      return block(
        e,
        isFolder
          ? "Folder upload is not permitted."
          : "File upload is not permitted."
      );
    }
  }, true);

  // ─── DRAG DROP ───
  document.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;

    if (dt?.files?.length) {
      return block(e, "Drag & drop upload is not permitted.");
    }

    if (dt?.items) {
      for (const item of dt.items) {
        if (item.kind === "file") {
          return block(e, "Drag & drop upload is not permitted.");
        }
      }
    }
  }, true);

  document.addEventListener("dragover", e => e.preventDefault(), true);
  document.addEventListener("dragenter", e => e.preventDefault(), true);

  // ─── PASTE ───
  document.addEventListener("paste", (e) => {
    for (const item of (e.clipboardData?.items || [])) {
      if (item.kind === "file" || item.type.startsWith("image/")) {
        return block(e, "Paste upload is not permitted.");
      }
    }
  }, true);

  // ─── FILE PICKER API ───
  const deny = () => Promise.reject(new Error("Blocked by policy"));
  window.showOpenFilePicker = deny;
  window.showDirectoryPicker = deny;
  window.showSaveFilePicker = deny;

  // ─── DISABLE INPUTS ───
  const disableFileInputs = function() {
    document.querySelectorAll('input[type="file"]:not([data-blocked])')
      .forEach(hardBlockInput);
  };
  disableFileInputs();

  // ─── OBSERVER ───
  new MutationObserver(() => disableFileInputs())
    .observe(document.documentElement, { childList: true, subtree: true });

  // ─── FILE READER ───
  const _read = FileReader.prototype.readAsDataURL;
  FileReader.prototype.readAsDataURL = function(blob) {
    if (blob instanceof File) {
      showAlert("Upload is not permitted.", "File read blocked.");
      return;
    }
    return _read.apply(this, arguments);
  };

  // ─── FORM DATA ───
  const _append = FormData.prototype.append;
  FormData.prototype.append = function(key, value, ...rest) {
    if (value instanceof File || value instanceof Blob) {
      showAlert("Upload is not permitted.", "File append blocked.");
      return;
    }
    return _append.call(this, key, value, ...rest);
  };

  // ─── FETCH ───
  const _fetch = window.fetch;
  window.fetch = function(resource, options = {}) {
    const body = options.body;
    if (body instanceof FormData) {
      for (const [, v] of body.entries()) {
        if (v instanceof File || v instanceof Blob) {
          showAlert("Upload is not permitted.", "Network upload blocked.");
          return Promise.reject();
        }
      }
    }
    return _fetch.apply(this, arguments);
  };

  // ─── XHR ───
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    if (body instanceof FormData) {
      for (const [, v] of body.entries()) {
        if (v instanceof File || v instanceof Blob) {
          showAlert("Upload is not permitted.", "XHR upload blocked.");
          return;
        }
      }
    }
    return _send.call(this, body);
  };
}