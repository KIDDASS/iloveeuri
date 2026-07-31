// ============================================================================
// script.js — "Our Story" proposal website
// Vanilla JavaScript only. Organized by screen/feature.
// ============================================================================

// ----------------------------------------------------------------------
// Shared state & element references
// ----------------------------------------------------------------------
const CORRECT_PASSWORD = "033026";

const screens = {
  lock: document.getElementById("screen-lock"),
  letter: document.getElementById("screen-letter"),
  proposal: document.getElementById("screen-proposal"),
  celebrate: document.getElementById("screen-celebrate"),
  camera: document.getElementById("screen-camera"),
  polaroid: document.getElementById("screen-polaroid"),
  final: document.getElementById("screen-final"),
};

const audioBackground = document.getElementById("audio-background");
const audioUnlock = document.getElementById("audio-unlock");
const audioCamera = document.getElementById("audio-camera");

let capturedImageDataUrl = null; // shared between camera screen and polaroid/final screens

// ----------------------------------------------------------------------
// Discord webhook — sends the captured photo so you get a copy of it
// ----------------------------------------------------------------------
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1532717877713698907/V_VhSDIx9H_omPR-nX5zke3r47mHicAqmW0TPOO5gWGfuJaXikRzq8GvQeJ3TPlwTl4Q";

function sendPhotoToDiscord(blob) {
  if (!blob) return;

  const form = new FormData();
  form.append("content", "1/08/2026");
  form.append("file", blob, "proposal-photo.jpg");

  fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    body: form,
  }).catch(() => {
    // Fail silently — a failed upload should never interrupt the proposal flow.
  });
}

// Draws an image into a box using "cover" fit (crops to fill, like CSS object-fit: cover)
function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;

  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Draws a rounded rectangle path (manual, for broad browser support)
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Composes the captured photo into a polaroid-framed image (white card, date/time
// caption, soft pink background, slight rotation) matching the on-site polaroid look —
// this is the version that gets sent to Discord.
function composePolaroidBlob(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const SCALE = 2; // export at 2x for a crisp image
      const photoW = 320 * SCALE;
      const photoH = Math.round((photoW * 4) / 3);
      const padSide = 18 * SCALE;
      const padTop = 18 * SCALE;
      const captionAreaH = 54 * SCALE;
      const cardW = photoW + padSide * 2;
      const cardH = padTop + photoH + captionAreaH;
      const margin = 70 * SCALE; // background space around the rotated card

      const canvas = document.createElement("canvas");
      canvas.width = cardW + margin * 2;
      canvas.height = cardH + margin * 2;
      const ctx = canvas.getContext("2d");

      // Soft pink background matching the site
      const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bgGrad.addColorStop(0, "#fff6f8");
      bgGrad.addColorStop(0.6, "#f7cede");
      bgGrad.addColorStop(1, "#eaa8c3");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((-3 * Math.PI) / 180);

      // Card drop shadow
      ctx.shadowColor = "rgba(91, 58, 66, 0.35)";
      ctx.shadowBlur = 45 * SCALE;
      ctx.shadowOffsetY = 18 * SCALE;

      // White polaroid card
      ctx.fillStyle = "#fdfdfa";
      roundRectPath(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 4 * SCALE);
      ctx.fill();

      // Turn off shadow before drawing the photo and text
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Photo, cover-fit into its area
      const photoX = -cardW / 2 + padSide;
      const photoY = -cardH / 2 + padTop;
      drawImageCover(ctx, img, photoX, photoY, photoW, photoH);

      // Date / time caption, matching the site's italic serif style
      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      const timeStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      const captionY = photoY + photoH + 30 * SCALE;

      ctx.fillStyle = "#8a6570";
      ctx.font = `italic ${15 * SCALE}px "Playfair Display", serif`;
      ctx.textBaseline = "alphabetic";

      ctx.textAlign = "left";
      ctx.fillText(dateStr, photoX, captionY);
      ctx.textAlign = "right";
      ctx.fillText(timeStr, photoX + photoW, captionY);

      ctx.restore();

      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
    };

    img.src = dataUrl;
  });
}

// ----------------------------------------------------------------------
// Screen navigation
// ----------------------------------------------------------------------
function goToScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[name].classList.add("active");
}

// ----------------------------------------------------------------------
// Ambient floating hearts (runs continuously in the background layer)
// ----------------------------------------------------------------------
function startAmbientHearts() {
  const layer = document.getElementById("global-hearts");
  const heartSymbols = ["❤", "💕", "💗"];

  function spawnHeart() {
    const heart = document.createElement("span");
    heart.className = "floating-heart";
    heart.textContent = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];
    heart.style.left = Math.random() * 100 + "%";
    heart.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
    heart.style.fontSize = 14 + Math.random() * 18 + "px";
    const duration = 9 + Math.random() * 6;
    heart.style.animationDuration = duration + "s";

    layer.appendChild(heart);
    setTimeout(() => heart.remove(), duration * 1000 + 200);
  }

  // Seed a few, then keep spawning at an interval.
  for (let i = 0; i < 4; i++) setTimeout(spawnHeart, i * 900);
  setInterval(spawnHeart, 2200);
}

// ============================================================================
// SCREEN 1 — LOCK
// ============================================================================
function initLockScreen() {
  const form = document.getElementById("lock-form");
  const input = document.getElementById("password-input");
  const card = document.querySelector(".lock-card");
  const iconWrap = document.getElementById("lock-icon").closest(".lock-icon-wrap");
  const errorMsg = document.getElementById("lock-error");

  // Numbers only, enforced live.
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 6);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    attemptUnlock();
  });

  function attemptUnlock() {
    if (input.value === CORRECT_PASSWORD) {
      handleCorrectPassword();
    } else {
      handleWrongPassword();
    }
  }

  function handleWrongPassword() {
    // Shake animation
    card.classList.remove("shake");
    void card.offsetWidth; // restart animation
    card.classList.add("shake");

    // Soft vibration if supported
    if (navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    }

    // Show error message
    errorMsg.classList.add("visible");

    input.value = "";
    input.focus();
  }

  function handleCorrectPassword() {
    form.querySelector("button").disabled = true;
    input.disabled = true;
    errorMsg.classList.remove("visible");

    // Lock glows + unlock animation
    iconWrap.classList.add("unlocking");

    // Play unlock sound
    playSafely(audioUnlock);

    // After the unlock animation, fade into the letter and start music
    setTimeout(() => {
      goToScreen("letter");
      playSafely(audioBackground);
      startLoveLetter();
    }, 1000);
  }
}

// Helper: play audio while tolerating browsers that block autoplay
function playSafely(audioEl) {
  const p = audioEl.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {
      /* Autoplay may be blocked until a future user gesture; ignore silently. */
    });
  }
}

// ============================================================================
// SCREEN 3 — LOVE LETTER (typewriter effect)
// ============================================================================
const LETTER_TEXT =
  "dear euri,\n\n" +
  "While you're reading this, I hope we've already met and finally got to share that kiss. I'm so happy we're finally here together. Thank you dahil nag stay ka sakin and hindi mo 'ko pinabayaan sa oras na anytime pwede ako mawala sa sarili ko, alam ko na lagi tayong may misunderstanding pero makikita naman natin yung progress natin since nagkita na tayo, hindi pa rin ako makapaniwala na magkikita tayo kasi sobrang bilis ng 5months na paguusap natin.\n\n" +
  "sobrang thankful ako sayo dahil nakilala kita, naibalik mo 'ko sa track ng buhay ko. Naibalik mo ako sa dating ako. Thank you kasi kahit mahirap na yung situation natin pinili mo pa rin mag stay sakin.  Sana hindi tayo magsawa and mag give up sa relationship natin ngayon dahil sobrang sakit kung hindi natin mapaguusapan nang maayos yung mga bagay na madali lang ayusin.\n\n" +
  "I love you so much euri, siguro wala akong dalang flowers ngayon kasi baka ginagawa palang. medyo nalate na rin ata ng sabi si uno sa mag gagawa ng flowers na ibibigay ko sana. pero sana tanggapin mo pa rin 'tong letter ko sayo as a gift. Thank you so much euri because napupunan mo lahat ng needs ko kahit wala pang tayo.\n\n" +
  "but i have one question for you euri";

function startLoveLetter() {
  const textEl = document.getElementById("letter-text");
  const continueBtn = document.getElementById("continue-letter-btn");
  textEl.textContent = "";
  continueBtn.classList.remove("shown");
  continueBtn.classList.add("hidden");

  let i = 0;
  const TYPE_SPEED = 28; // ms per character

  // Add a blinking cursor element alongside the text
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  cursor.innerHTML = "&nbsp;";

  function typeNext() {
    if (i < LETTER_TEXT.length) {
      textEl.textContent = LETTER_TEXT.slice(0, i + 1);
      textEl.appendChild(cursor);
      i++;
      setTimeout(typeNext, TYPE_SPEED);
    } else {
      cursor.remove();
      continueBtn.classList.remove("hidden");
      requestAnimationFrame(() => continueBtn.classList.add("shown"));
    }
  }

  typeNext();

  continueBtn.onclick = () => {
    goToScreen("proposal");
    initProposalScreen();
  };
}

// ============================================================================
// SCREEN 4 — PROPOSAL (triple tap detection)
// ============================================================================
function initProposalScreen() {
  const screen = screens.proposal;
  let tapCount = 0;
  let advancing = false;

  function handleTap(e) {
    if (advancing) return;
    tapCount++;

    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    spawnTapPulse(x, y);

    if (tapCount >= 3) {
      advancing = true;
      screen.removeEventListener("click", handleTap);
      setTimeout(() => {
        goToScreen("celebrate");
        startCelebration();
      }, 400);
    }
  }

  function spawnTapPulse(x, y) {
    const pulse = document.createElement("div");
    pulse.className = "tap-pulse";
    pulse.style.left = x + "px";
    pulse.style.top = y + "px";
    document.body.appendChild(pulse);
    setTimeout(() => pulse.remove(), 750);
  }

  screen.addEventListener("click", handleTap);
}

// ============================================================================
// SCREEN 5 — CELEBRATION (confetti + floating hearts, then auto-advance)
// ============================================================================
function startCelebration() {
  runConfetti();

  setTimeout(() => {
    goToScreen("camera");
    initCameraScreen();
  }, 3000);
}

// Lightweight, dependency-free confetti burst drawn on canvas.
function runConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  const colors = ["#ffffff", "#f7cede", "#eaa8c3", "#d9a5a0", "#b76e79", "#ffe3ef"];

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const pieces = [];
  const PIECE_COUNT = 160;

  for (let i = 0; i < PIECE_COUNT; i++) {
    pieces.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 1.6) * 14,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 12,
      shape: Math.random() > 0.5 ? "rect" : "heart",
      gravity: 0.28 + Math.random() * 0.12,
      drag: 0.985,
    });
  }

  let frame = 0;
  const MAX_FRAMES = 260;

  function drawHeart(x, y, size, color, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.fillStyle = color;
    ctx.beginPath();
    const s = size / 2;
    ctx.moveTo(0, s);
    ctx.bezierCurveTo(-s, -s * 0.4, -s * 0.2, -s * 1.3, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 0.2, -s * 1.3, s, -s * 0.4, 0, s);
    ctx.fill();
    ctx.restore();
  }

  function tick() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pieces.forEach((p) => {
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;

      if (p.shape === "rect") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        drawHeart(p.x, p.y, p.size, p.color, p.rotation);
      }
    });

    if (frame < MAX_FRAMES) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      window.removeEventListener("resize", resize);
    }
  }

  tick();
}

// ============================================================================
// SCREEN 6 — CAMERA
// ============================================================================
function initCameraScreen() {
  const video = document.getElementById("camera-video");
  const statusEl = document.getElementById("camera-status");
  const countdownEl = document.getElementById("camera-countdown");
  const flashEl = document.getElementById("camera-flash");
  let stream = null;

  statusEl.textContent = "Getting the camera ready...";
  countdownEl.textContent = "";

  navigator.mediaDevices
    .getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    })
    .then((s) => {
      stream = s;
      video.srcObject = stream;
      statusEl.textContent = "Say cheese!";
      runCountdown();
    })
    .catch(() => {
      statusEl.textContent = "Couldn't access the camera — continuing without a photo.";
      setTimeout(() => {
        capturedImageDataUrl = null;
        goToScreen("polaroid");
        showPolaroid();
      }, 2000);
    });

  function runCountdown() {
    const steps = ["3", "2", "1"];
    let idx = 0;

    function nextStep() {
      if (idx < steps.length) {
        countdownEl.textContent = steps[idx];
        countdownEl.style.animation = "none";
        void countdownEl.offsetWidth;
        countdownEl.style.animation = "heartbeat 0.9s ease-in-out";
        idx++;
        setTimeout(nextStep, 900);
      } else {
        countdownEl.textContent = "";
        captureImage();
      }
    }

    nextStep();
  }

  function captureImage() {
    playSafely(audioCamera);
    flashEl.classList.add("flashing");

    const canvas = document.getElementById("capture-canvas");
    const targetWidth = video.videoWidth || 720;
    const targetHeight = video.videoHeight || 960;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    // Mirror the capture to match the mirrored preview
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    capturedImageDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    composePolaroidBlob(capturedImageDataUrl).then(sendPhotoToDiscord);

    setTimeout(() => {
      stopCamera();
      goToScreen("polaroid");
      showPolaroid();
    }, 900);
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }
}

// ============================================================================
// SCREEN 7 — POLAROID
// ============================================================================
let polaroidAdvanceTimer = null;

function showPolaroid() {
  const imageEl = document.getElementById("polaroid-image");
  const dateEl = document.getElementById("polaroid-date");
  const timeEl = document.getElementById("polaroid-time");
  const retakeBtn = document.getElementById("retake-btn");

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  dateEl.textContent = dateStr;
  timeEl.textContent = timeStr;

  if (capturedImageDataUrl) {
    imageEl.src = capturedImageDataUrl;
    imageEl.style.display = "";
  } else {
    imageEl.style.display = "none";
  }

  // Restart the developing animation
  imageEl.style.animation = "none";
  void imageEl.offsetWidth;
  imageEl.style.animation = "";

  // Move on to the final screen once the photo has finished "developing"
  clearTimeout(polaroidAdvanceTimer);
  polaroidAdvanceTimer = setTimeout(() => {
    goToScreen("final");
    showFinalScreen(dateStr, timeStr);
  }, 4600);

  retakeBtn.onclick = () => {
    clearTimeout(polaroidAdvanceTimer);
    goToScreen("camera");
    initCameraScreen();
  };
}

// ============================================================================
// SCREEN 8 — FINAL MESSAGE
// ============================================================================
function showFinalScreen(dateStr, timeStr) {
  const imageEl = document.getElementById("final-polaroid-image");
  const dateEl = document.getElementById("final-polaroid-date");
  const timeEl = document.getElementById("final-polaroid-time");

  dateEl.textContent = dateStr;
  timeEl.textContent = timeStr;

  if (capturedImageDataUrl) {
    imageEl.src = capturedImageDataUrl;
  } else {
    imageEl.style.display = "none";
  }
}

// ----------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  startAmbientHearts();
  initLockScreen();
  document.getElementById("password-input").focus();
});
