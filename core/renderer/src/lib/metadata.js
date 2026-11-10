const text = (value) => typeof value === "string" ? value.trim() : "";
function siteCover(site, posts) {
    const timestamp = (value) => {
        if (value && typeof value === "object" && "timestamp" in value && typeof value.timestamp === "number")
            return value.timestamp;
        const time = value ? new Date(String(value)).valueOf() : NaN;
        return Number.isNaN(time) ? -Infinity : time;
    };
    const post = posts.filter(post => post.draft !== true && (text(post.image) || text(post.ogImage)))
        .sort((a, b) => timestamp(b.date) - timestamp(a.date) || (a.href ?? "").localeCompare(b.href ?? ""))[0];
    return post
        ? { image: text(post.image) || text(post.ogImage), alt: (text(post.image) ? text(post.imageAlt) : text(post.ogImageAlt)) || text(post.title) }
        : { image: text(site.logo), alt: text(site.name) };
}
export function pageMetadata(site, page, url, article = false, basePath = "", posts = [], listing) {
    const seo = site.seo && typeof site.seo === "object" ? site.seo : {};
    const homepage = !article && (listing?.path ?? new URL(url).pathname).replace(/\/+$/, "") === basePath.replace(/\/+$/, "");
    // Homepage overrides also apply to later pages of its feed.
    if (homepage)
        page = { ...seo, ...page };
    const title = text(page.title) || text(site.name);
    const pageTitle = title === site.name ? title : `${title} — ${text(site.name)}`;
    const suffix = listing && listing.page > 1 ? ` — Page ${listing.page}` : "";
    const documentTitle = (text(page.metaTitle) || (homepage && text(seo.metaTitle)) || pageTitle) + suffix;
    const description = text(page.metaDescription) || text(page.description) || text(site.description);
    const socialTitle = (text(page.ogTitle) || (homepage && (text(seo.ogTitle) || text(seo.metaTitle))) || title) + suffix;
    const socialDescription = text(page.ogDescription) || text(page.description) || text(seo.ogDescription) || description;
    const canonical = new URL(url);
    canonical.search = "";
    canonical.hash = "";
    if (!homepage || listing && listing.page > 1)
        canonical.pathname = canonical.pathname.replace(/\/+$/, "");
    else
        canonical.pathname = basePath.replace(/\/+$/, "") + "/";
    const resolveUrl = (value) => {
        try {
            const resolved = text(value) && new URL(text(value), canonical);
            return resolved && ["https:", "http:"].includes(resolved.protocol) ? resolved.href : "";
        }
        catch {
            return "";
        }
    };
    const resolveAssetUrl = value => resolveUrl(text(value).startsWith("/") && !text(value).startsWith("//") ? basePath + text(value) : value);
    const explicitImage = text(page.ogImage) || text(page.image) || text(seo.ogImage);
    const fallback = homepage && !explicitImage ? siteCover(site, posts) : undefined;
    const imageUrl = resolveAssetUrl(explicitImage || fallback?.image);
    const imageAlt = text(page.ogImageAlt) || (fallback ? fallback.alt : page.ogImage || page.image ? text(page.imageAlt) : text(seo.ogImageAlt));
    const twitterImageUrl = resolveAssetUrl(page.twitterImage) || imageUrl;
    const language = text(page.language) || text(site.language) || "en";
    let locale = "";
    try {
        const parsed = new Intl.Locale(language).maximize();
        locale = `${parsed.language}_${parsed.region}`;
    }
    catch { }
    const keywords = page.keywords || seo.keywords || "";
    return {
        documentTitle, description, socialTitle, socialDescription, imageUrl, imageAlt, language, locale,
        canonical: suffix ? canonical.href : resolveUrl(page.canonicalUrl) || canonical.href,
        keywords: Array.isArray(keywords) ? keywords.filter(value => typeof value === "string").join(", ") : text(keywords),
        robots: page.noindex === true ? "noindex, follow" : "index, follow",
        videoUrl: resolveAssetUrl(page.ogVideo), videoType: text(page.ogVideoType),
        twitterTitle: text(page.twitterTitle) ? text(page.twitterTitle) + suffix : socialTitle,
        twitterDescription: text(page.twitterDescription) || socialDescription,
        twitterImageUrl, twitterImageAlt: text(page.twitterImageAlt) || (page.twitterImage ? "" : imageAlt),
        twitterCard: ["summary", "summary_large_image"].includes(text(page.twitterCard)) ? text(page.twitterCard) : twitterImageUrl ? "summary_large_image" : "summary",
        twitterSite: text(page.twitterSite), twitterCreator: text(page.twitterCreator),
    };
}
