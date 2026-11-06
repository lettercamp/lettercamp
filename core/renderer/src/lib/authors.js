export function readAuthors(value) {
    if (!Array.isArray(value))
        return [];
    return value.flatMap(item => item && typeof item.name === "string"
        ? [{ name: item.name, ...(typeof item.image === "string" && item.image.trim() ? { image: item.image.trim() } : {}) }] : []);
}
// Keep blank names while editing; only bylines omit unfinished author rows.
export function resolveAuthors(source) {
    return readAuthors(source.authors);
}
// Names alone are not identities: two contributors can share a name.
export function authorKey(author) {
    return JSON.stringify([author.name.trim().toLowerCase(), author.image || ""]);
}
export function uniqueAuthors(authors) {
    return [...new Map(authors.filter(author => author.name.trim()).map(author => [authorKey(author), author])).values()];
}
