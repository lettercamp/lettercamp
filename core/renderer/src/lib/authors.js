export function readAuthors(value) {
    if (!Array.isArray(value))
        return [];
    return value.flatMap(item => {
        if (!item || typeof item.name !== "string") return [];
        const author = { name: item.name };
        if (typeof item.image === "string" && item.image.trim()) author.image = item.image.trim();
        if (typeof item.bio === "string" && item.bio.trim()) author.bio = item.bio.trim();
        return [author];
    });
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
