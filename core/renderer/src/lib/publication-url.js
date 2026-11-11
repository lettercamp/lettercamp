// Publication paths are relative to the blog; absolute URLs can link to the parent website.
export function publicationBasePath(url) {
    return new URL(url).pathname.replace(/\/+$/, "");
}
export function publicationPath(path, basePath = "") {
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//"))
        return path;
    const base = basePath.replace(/\/+$/, "");
    return base + (base ? path.replace(/^\/(?=[?#]|$)/, "") : path);
}
export function publicationUrl(path, siteUrl) {
    return new URL(publicationPath(path, publicationBasePath(siteUrl)), siteUrl);
}
