export const defaultSiteBranding = {
  name: 'Lettercamp Blog',
  logo: 'https://lettercamp.com/lettercamp-logo.png?v=7',
  favicon: 'https://lettercamp.com/favicon-96x96.png?v=7',
};

export function withDefaultBranding(source) {
  const branding = Object.fromEntries(Object.entries(defaultSiteBranding).map(([key, fallback]) =>
    [key, typeof source[key] === 'string' && source[key].trim() ? source[key] : fallback]));
  // An explicit empty logo disables the image while omitted logos keep the default.
  if (typeof source.logo === 'string') branding.logo = source.logo.trim();
  return {
    ...source,
    ...branding,
    home: { ...source.home, title: source.home?.title ?? (branding.name === defaultSiteBranding.name ? branding.name : `${branding.name} Blog`) },
  };
}
