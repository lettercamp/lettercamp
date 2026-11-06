type RelatedPost = { href: string; title?: unknown; description?: unknown; category?: unknown; draft?: unknown };

// Shared by the static renderer and editor preview. Keep this function self-contained
// so the preview bridge can embed it without shipping a separate client bundle.
export function createRelatedPostSelector<T extends RelatedPost>(posts: T[], language = "en") {
  const stopWords: Record<string, string> = {
    en: "a an and are as at be been but by for from has have how in is it its of on or our that the their this to was we were what when which who will with you your",
    es: "a al con de del el en es esta este la las lo los o para por que se su sus un una y",
    fr: "a au aux avec ce ces dans de des du elle en est et il la le les leur ou par pas pour que qui se son sur un une",
    de: "am an auf aus bei das dem den der des die ein eine einer es für im in ist mit oder sich sind und von zu zum zur",
    it: "a al alla che con da dal dei del della di e è gli i il in la le lo o per si su un una",
    pt: "a ao as com da das de do dos e em é na nas no nos o os ou para por que se sua um uma",
  };
  const ignored = new Set((stopWords[language.toLowerCase().split("-")[0]] ?? "").split(" "));
  const segmenter = new Intl.Segmenter(language, { granularity: "word" });
  const text = {
    normalize(value: unknown) {
      return typeof value === "string" ? value.normalize("NFKC").toLocaleLowerCase(language).trim() : "";
    },
    prepare(post: T) {
      const words = new Map<string, number>();
      for (const [value, weight] of [[post.description, 1], [post.title, 3]] as const) {
        for (const part of segmenter.segment(text.normalize(value))) {
          if (part.isWordLike && !ignored.has(part.segment)) words.set(part.segment, weight);
        }
      }
      return { post, words, weight: [...words.values()].reduce((sum, weight) => sum + weight, 0), category: text.normalize(post.category) };
    },
    hash(value: string) {
      let result = 2166136261;
      for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
      return result >>> 0;
    },
  };
  const candidates = [...new Map(posts.filter(post => post.draft !== true).map(post => [post.href, post])).values()].map(text.prepare);
  const byHref = new Map(candidates.map(candidate => [candidate.post.href, candidate]));
  return (current: T): T[] => {
    const existing = byHref.get(current.href);
    const source = existing?.post === current ? existing : text.prepare(current);
    return candidates.filter(candidate => candidate.post.href !== current.href).map(candidate => {
      let overlap = 0;
      for (const [word, weight] of source.words) overlap += Math.min(weight, candidate.words.get(word) ?? 0);
      const union = source.weight + candidate.weight - overlap;
      const score = (union ? 75 * overlap / union : 0) + (source.category && source.category === candidate.category ? 25 : 0);
      return { post: candidate.post, score, tie: text.hash(current.href + "\n" + candidate.post.href) };
    }).sort((a, b) => b.score - a.score || a.tie - b.tie || (a.post.href < b.post.href ? -1 : a.post.href > b.post.href ? 1 : 0))
      .slice(0, 3).map(candidate => candidate.post);
  };
}
