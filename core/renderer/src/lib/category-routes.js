export function categoryTag(category) {
    return category.trim().normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "category";
}
export function categoryRoutes(categories) {
    const names = [...new Set(categories.map(name => name.trim()).filter(Boolean))];
    const used = new Set();
    const tags = new Map();
    // Assign unique tags independently of the posts' date order.
    for (const name of [...names].sort()) {
        const base = categoryTag(name);
        let tag = base;
        for (let suffix = 2; used.has(tag); suffix++)
            tag = `${base}-${suffix}`;
        used.add(tag);
        tags.set(name, tag);
    }
    return names.map(name => ({ name, tag: tags.get(name), href: `/category/${encodeURIComponent(tags.get(name))}/` }));
}
