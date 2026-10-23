const { createCanvas, loadImage } = require("@napi-rs/canvas");

/**
 * Draw a pointed-top and pointed-bottom rounded hexagon
 */
function drawRoundedHexagon(ctx, cx, cy, width, height, cornerR, strokeColor, strokeWidth, text, fontSize) {
  const halfW = width / 2;
  const halfH = height / 2;
  const peak = height * 0.28;

  // 6 vertices of pointed-top & pointed-bottom hexagon
  const pts = [
    { x: cx, y: cy - halfH },                  // Top peak
    { x: cx + halfW, y: cy - halfH + peak },   // Top right
    { x: cx + halfW, y: cy + halfH - peak },   // Bottom right
    { x: cx, y: cy + halfH },                  // Bottom peak
    { x: cx - halfW, y: cy + halfH - peak },   // Bottom left
    { x: cx - halfW, y: cy - halfH + peak }    // Top left
  ];

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const curr = pts[i];
    const prev = pts[(i + 5) % 6];
    const next = pts[(i + 1) % 6];

    // Direction vectors
    const vPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const vNext = { x: next.x - curr.x, y: next.y - curr.y };
    const dPrev = Math.hypot(vPrev.x, vPrev.y);
    const dNext = Math.hypot(vNext.x, vNext.y);

    const r = Math.min(cornerR, dPrev / 2, dNext / 2);
    const p1 = { x: curr.x + (vPrev.x / dPrev) * r, y: curr.y + (vPrev.y / dPrev) * r };
    const p2 = { x: curr.x + (vNext.x / dNext) * r, y: curr.y + (vNext.y / dNext) * r };

    if (i === 0) {
      ctx.moveTo(p1.x, p1.y);
    } else {
      ctx.lineTo(p1.x, p1.y);
    }
    ctx.quadraticCurveTo(curr.x, curr.y, p2.x, p2.y);
  }
  ctx.closePath();

  ctx.strokeStyle = strokeColor || "#FFFFFF";
  ctx.lineWidth = strokeWidth || 8;
  ctx.stroke();

  if (text !== undefined && text !== null) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${fontSize || 68}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(text), cx, cy + 3);
  }
  ctx.restore();
}

/**
 * Draw right-pointing arrow
 */
function drawArrow(ctx, x, y, width, height) {
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  const barH = height * 0.46;
  const barW = width * 0.55;

  const leftX = x - width / 2;
  const topY = y - barH / 2;
  const r = barH / 2;

  ctx.moveTo(leftX + r, topY);
  ctx.lineTo(leftX + barW, topY);
  ctx.lineTo(leftX + barW, y - height / 2);
  ctx.lineTo(leftX + width, y);
  ctx.lineTo(leftX + barW, y + height / 2);
  ctx.lineTo(leftX + barW, topY + barH);
  ctx.lineTo(leftX + r, topY + barH);
  ctx.arc(leftX + r, y, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Generate pixel-perfect Level Up Card Banner matching RoomUp V1 specification
 * @param {Object} options
 * @param {number} options.oldLevel Previous level (e.g. 0)
 * @param {number} options.newLevel New level achieved (e.g. 1)
 * @param {string} options.avatarUrl User's Discord avatar URL or path
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function renderLevelUpCard(options = {}) {
  const {
    oldLevel = 0,
    newLevel = 1,
    avatarUrl = null
  } = options;

  // High-resolution canvas (Scale 2x: 1080 x 280)
  const W = 1080;
  const H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Rounded outer card
  const cardRadius = 36;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, cardRadius);
  ctx.clip();

  // Gradient: Purple (#681BB6) -> Violet (#851DAA) -> Magenta (#BF2385) -> Coral (#C44651) -> Terracotta (#C47047)
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0.00, "#681BB6");
  grad.addColorStop(0.18, "#851DAA");
  grad.addColorStop(0.35, "#A61E9D");
  grad.addColorStop(0.52, "#BF2385");
  grad.addColorStop(0.70, "#C62E69");
  grad.addColorStop(0.85, "#C44651");
  grad.addColorStop(1.00, "#C47047");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const centerY = H / 2;

  // Hexagon 1: Old Level
  const hexW = 146;
  const hexH = 168;
  const hex1X = 140;
  drawRoundedHexagon(ctx, hex1X, centerY, hexW, hexH, 16, "#FFFFFF", 9, oldLevel, 68);

  // Right Arrow
  const arrowX = 262;
  const arrowW = 54;
  const arrowH = 40;
  drawArrow(ctx, arrowX, centerY, arrowW, arrowH);

  // Hexagon 2: New Level
  const hex2X = 385;
  drawRoundedHexagon(ctx, hex2X, centerY, hexW, hexH, 16, "#FFFFFF", 9, newLevel, 68);

  // Red pill badge above "level up!"
  const pillW = 68;
  const pillH = 34;
  const pillX = 525;
  const pillY = centerY - 62;
  ctx.save();
  ctx.fillStyle = "#ED4245"; // Discord red
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 12);
  ctx.fill();
  ctx.restore();

  // "level up!" Serif typography
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 64px "Georgia", "DejaVu Serif", "Times New Roman", serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("level up!", 500, pillY + pillH + 10);
  ctx.restore();

  // Avatar Card on the Right
  const avatarSize = 216;
  const avatarX = W - avatarSize - 32;
  const avatarY = (H - avatarSize) / 2;
  const avatarRadius = 32;
  const borderWidth = 12;

  ctx.save();
  // Warm Gold / Tan border
  ctx.strokeStyle = "#BD7D48";
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, avatarRadius);
  ctx.stroke();

  // Clip avatar image inside
  ctx.beginPath();
  ctx.roundRect(
    avatarX + borderWidth / 2,
    avatarY + borderWidth / 2,
    avatarSize - borderWidth,
    avatarSize - borderWidth,
    avatarRadius - borderWidth / 2
  );
  ctx.clip();

  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl);
      ctx.drawImage(
        img,
        avatarX + borderWidth / 2,
        avatarY + borderWidth / 2,
        avatarSize - borderWidth,
        avatarSize - borderWidth
      );
    } catch (e) {
      ctx.fillStyle = "#5865F2";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }
  } else {
    ctx.fillStyle = "#5865F2";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  return canvas.toBuffer("image/png");
}

module.exports = {
  renderLevelUpCard
};
