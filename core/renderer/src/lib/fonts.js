import { fontFallbacks } from "./font-fallbacks.js";
import { fontCatalog } from "./font-catalog.js";
export function fontResources(typography = {}, headingWeight = 500, basePath = "") {
    const localFonts = typography.localFonts === true;
    const fontUrl = (face) => localFonts ? basePath + new URL(face.url).pathname : face.url;
    const quote = (value) => '"' + Array.from(String(value), char => /[a-zA-Z0-9 -]/.test(char) ? char : '\\' + char.codePointAt(0).toString(16) + ' ').join('') + '"';
    const google = new Set();
    const resolved = new Set();
    const preloads = new Set();
    const custom = new Map();
    const faces = [];
    const resolve = (input, criticalWeight) => {
        const value = input && typeof input === "object" ? input : undefined;
        if (value && typeof value.url === 'string' && value.url.trim() && !(typeof value.google === 'string' && value.google.trim())) {
            try {
                const local = !/^(?:[a-z][\w+.-]*:|\/\/)/i.test(value.url);
                const url = new URL(value.url, 'https://lettercamp-local.invalid/');
                if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
                    throw new Error();
                const weight = typeof value.weight === 'string' && /^(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/.test(value.weight) ? value.weight : '400';
                const href = local ? basePath + url.pathname + url.search + url.hash : url.href;
                const key = href + ' ' + weight;
                if (!custom.has(key)) {
                    const family = 'Lettercamp Custom ' + custom.size;
                    custom.set(key, family);
                    faces.push('@font-face{font-family:' + quote(family) + ';src:url(' + quote(href) + ');font-weight:' + weight + ';font-style:normal;font-display:swap;}');
                }
                return quote(custom.get(key)) + ', Arial, Helvetica, sans-serif';
            }
            catch { /* Invalid custom URLs use the default family. */ }
        }
        const family = value && typeof value.google === 'string' && value.google.trim() ? value.google.trim() : 'Inter';
        const catalog = Object.hasOwn(fontCatalog, family) ? fontCatalog[family] : undefined;
        if (catalog) {
            if (!resolved.has(family))
                for (const face of catalog.faces) {
                    faces.push('@font-face{font-family:' + quote(family) + ';src:url(' + quote(fontUrl(face)) + ') format("woff2");font-weight:' + face.weight
                        + ';font-style:normal;font-display:swap;unicode-range:' + face.unicodeRange + ';}');
                }
            // Prioritize only the title and body Latin files. Other subsets load on demand.
            const distance = (weight) => {
                const [min, max = min] = weight.split(' ').map(Number);
                return Math.max(min - criticalWeight, criticalWeight - max, 0);
            };
            const critical = catalog.faces.filter(face => face.subset === 'latin').sort((a, b) => distance(a.weight) - distance(b.weight))[0];
            if (critical)
                preloads.add(fontUrl(critical));
        }
        else {
            if (localFonts) throw new Error(`Font "${family}" is not in the local font catalog. Use a bundled font or a custom local font URL.`);
            // Preserve support for existing CLI settings naming fonts outside our picker.
            google.add(family);
        }
        const fallback = Object.hasOwn(fontFallbacks, family) ? fontFallbacks[family] : undefined;
        if (fallback) {
            const alias = family + ' Fallback';
            if (!resolved.has(family))
                for (const face of fallback.faces) {
                    faces.push('@font-face{font-family:' + quote(alias) + ';src:' + face.local.map(name => 'local(' + quote(name) + ')').join(',')
                        + ';font-weight:' + face.weight + ';font-style:normal;size-adjust:' + face.sizeAdjust
                        + ';ascent-override:' + face.ascentOverride + ';descent-override:' + face.descentOverride + ';line-gap-override:' + face.lineGapOverride + ';}');
                }
            resolved.add(family);
            return quote(family) + ', ' + quote(alias) + ', ' + fallback.generic;
        }
        resolved.add(family);
        return quote(family) + ', Arial, Helvetica, sans-serif';
    };
    const headingFamily = resolve(typography.headingFont, headingWeight);
    const bodyFamily = resolve(typography.bodyFont, 400);
    return {
        headingFamily, bodyFamily, css: faces.join('\n'), preloads: [...preloads],
        googleUrl: google.size ? 'https://fonts.googleapis.com/css2?' + [...google].map(family => 'family=' + encodeURIComponent(family) + ':wght@' + (Object.hasOwn(fontFallbacks, family) ? fontFallbacks[family].faces.map(face => face.weight).join(';') : '400;500;600;700')).join('&') + '&display=swap' : null,
    };
}
