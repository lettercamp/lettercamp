// Shared by published sites and live previews. Keep this function self-contained:
// the preview bridge embeds it in the publication iframe.
export function siteColors(design?: { backgroundColor?: unknown; accentColor?: unknown; typography?: { headingColor?: unknown; bodyColor?: unknown } }): Record<string, string> {
  const [background, accent] = [design?.backgroundColor, design?.accentColor].map((value, index) =>
    typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : index === 0 ? "#ffffff" : "");
  const luminance = (color: string) => {
    const linear = [1, 3, 5].map(offset => {
      const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05);
  };
  const [text, accentText] = [background, accent || background].map(color => {
    return contrast(color, "#000000") >= contrast(color, "#ffffff") ? "#000000" : "#ffffff";
  });
  const base = [1, 3, 5].map(offset => parseInt(background.slice(offset, offset + 2), 16));
  const target = text === "#000000" ? 0 : 255;
  const blend = (amount: number) => "#" + base.map(channel => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, "0")).join("");
  // Test the rounded sRGB color, not a perceptual distance or rounded ratio.
  // Keep the least contrast possible while still meeting WCAG AA for small text.
  const readable = (amount: number, backgrounds: string[]) => {
    const passes = (value: number) => backgrounds.every(bg => contrast(blend(value), bg) >= 4.5);
    if (passes(amount)) return blend(amount);
    let low = amount, high = 1;
    for (let step = 0; step < 24; step++) {
      const middle = (low + high) / 2;
      if (passes(middle)) high = middle;
      else low = middle;
    }
    return blend(high);
  };
  // Reference grays on white. Retain each shade's distance along the
  // background-to-foreground scale; e.g. 250 preserves #fafafa on white.
  const shades: Record<string, number> = {
    "surface": 250,
    "surface-hover": 245,
    "surface-active": 238,
    "border": 240,
    "border-strong": 221,
    "text-strong": 65,
    "text-secondary": 111,
    "text-muted": 134,
    "text-faint": 180,
  };
  const colors: Record<string, string> = {
    "color-scheme": target === 255 ? "dark" : "light",
    "--site-background": background,
    "--site-foreground": text,
    "--site-accent": accent || "inherit",
    "--site-accent-text": accent ? accentText : "inherit",
    "--site-code-tint": target === 255 ? "45%" : "0%",
  };
  for (const [name, gray] of Object.entries(shades)) {
    let amount = 1 - gray / 255;
    // Midtone backgrounds may barely pass with black or white. Do not tint
    // their surfaces so far that even the foreground can no longer pass.
    if (name.startsWith("surface") && contrast(blend(amount), text) < 4.5) {
      let low = 0, high = amount;
      for (let step = 0; step < 24; step++) {
        const middle = (low + high) / 2;
        if (contrast(blend(middle), text) >= 4.5) low = middle;
        else high = middle;
      }
      amount = low;
    }
    colors[`--site-${name}`] = blend(amount);
  }
  const surfaces = [background, colors["--site-surface"], colors["--site-surface-hover"], colors["--site-surface-active"]];
  for (const name of ["text-strong", "text-secondary"]) {
    colors[`--site-${name}`] = readable(1 - shades[name] / 255, surfaces);
  }
  colors["--site-text-muted"] = colors["--site-text-faint"] = readable(0, [background]);
  colors["--site-text-on-surface"] = readable(0, surfaces);
  // Typography overrides do not change the automatic UI palette.
  for (const role of ["heading", "body"] as const) {
    const value = design?.typography?.[`${role}Color`];
    colors[`--site-${role}-color`] = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : text;
  }
  return colors;
}

// Also injected into older published pages by the live design preview.
export const typographyColorStyles = `
body { color: var(--site-body-color, var(--site-foreground)); }
.blog-heading h1, .article-header h1, .article-intro h1, .post-card h3,
.related-posts > h2, .prose :is(h1, h2, h3, h4, h5, h6) {
  color: var(--site-heading-color, var(--site-foreground));
}
`;
