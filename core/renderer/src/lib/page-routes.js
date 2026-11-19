export function isPagePath(path) {
  const parts = path.split('/');
  return parts[0] === 'pages' && parts.length > 1
    && !/[\\\x00-\x1f\x7f:]/.test(path)
    && parts.every(part => part && !part.startsWith('.'))
    && /\.mdx?$/.test(path) && !/^pages\/index\.mdx?$/.test(path);
}

export function pageRoute(path) {
  return path.replace(/^pages\//, '').replace(/\.mdx?$/, '').replace(/\/index$/, '');
}

export function isStandalonePage(path, frontmatter) {
  return frontmatter?.type === 'page' || /\/index\.mdx?$/.test(path);
}

export function reservedPageRoute(slug) {
  return /^(?:category\/[^/]+(?:\/page\/[1-9]\d*)?|page\/[1-9]\d*)$/.test(slug);
}
