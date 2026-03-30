const AVATAR_PALETTES = [
  { background: '#f3dfd2', accent: '#8e5b56', text: '#53383a' },
  { background: '#efe3cf', accent: '#ac7d49', text: '#59442b' },
  { background: '#dce7df', accent: '#6f8d79', text: '#345142' },
  { background: '#e5dde8', accent: '#86709a', text: '#473a57' }
];

export function buildAvatarUrl(
  avatarUrl: string | null | undefined,
  displayName: string,
  userName?: string
): string {
  if (avatarUrl && avatarUrl.trim()) {
    return avatarUrl.trim();
  }

  return buildDefaultAvatarDataUri(displayName || userName || 'Invite');
}

function buildDefaultAvatarDataUri(seedValue: string): string {
  const palette = pickPalette(seedValue);
  const initials = getInitials(seedValue);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.background}" />
          <stop offset="100%" stop-color="${palette.accent}" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="36" fill="url(#bg)" />
      <circle cx="60" cy="46" r="20" fill="rgba(255,255,255,0.35)" />
      <path d="M28 102c6-18 20-28 32-28s26 10 32 28" fill="rgba(255,255,255,0.3)" />
      <text x="60" y="69" text-anchor="middle" font-size="34" font-family="Georgia, serif" fill="${palette.text}" font-weight="700">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function pickPalette(seedValue: string) {
  const seed = Array.from(seedValue).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return AVATAR_PALETTES[seed % AVATAR_PALETTES.length];
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return 'M';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
