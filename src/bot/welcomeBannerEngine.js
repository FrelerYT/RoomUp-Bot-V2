const { AttachmentBuilder } = require("discord.js");

function generateWelcomeCardSvg(username, guildName, memberCount, avatarUrl = "") {
  const safeUser = (username || "Membro").replace(/[<>&"']/g, "");
  const safeGuild = (guildName || "Server").replace(/[<>&"']/g, "");

  return `
<svg width="800" height="300" viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0c10" />
      <stop offset="50%" stop-color="#131722" />
      <stop offset="100%" stop-color="#181d2a" />
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5865F2" />
      <stop offset="100%" stop-color="#00d2ff" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="15" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Card Background -->
  <rect width="800" height="300" rx="20" fill="url(#bgGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="2" />

  <!-- Neon Glow accents -->
  <circle cx="700" cy="50" r="120" fill="#5865F2" opacity="0.15" filter="url(#glow)" />
  <circle cx="100" cy="250" r="100" fill="#00d2ff" opacity="0.12" filter="url(#glow)" />

  <!-- Avatar Placeholder Circle with Border -->
  <circle cx="140" cy="150" r="70" fill="#1f2536" stroke="url(#primaryGrad)" stroke-width="5" />
  <text x="140" y="165" font-family="'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle">👋</text>

  <!-- Welcome Typography -->
  <text x="250" y="105" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#7983f5" letter-spacing="2">BENVENUTO NEL SERVER</text>
  <text x="250" y="160" font-family="'Segoe UI', Roboto, sans-serif" font-size="40" font-weight="900" fill="#ffffff">${safeUser}</text>
  <text x="250" y="200" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#8b949e">Ti diamo il benvenuto in ${safeGuild}!</text>

  <!-- Member Count Badge -->
  <rect x="250" y="225" width="220" height="38" rx="10" fill="rgba(88, 101, 242, 0.2)" stroke="rgba(88, 101, 242, 0.4)" />
  <text x="360" y="250" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#00d2ff" text-anchor="middle">👥 MEMBRO #${memberCount}</text>
</svg>
`;
}

function createWelcomeAttachment(username, guildName, memberCount, avatarUrl) {
  const svg = generateWelcomeCardSvg(username, guildName, memberCount, avatarUrl);
  const buffer = Buffer.from(svg, "utf8");
  return new AttachmentBuilder(buffer, { name: "welcome-banner.svg" });
}

module.exports = {
  generateWelcomeCardSvg,
  createWelcomeAttachment
};
