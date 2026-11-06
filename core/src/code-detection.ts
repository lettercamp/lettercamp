// Keep detection identical in the editor, draft preview, and publication build.
// Explicit languages (including plain text) always take precedence.
export const isAutomaticCodeLanguage = (language: string) => !language.trim() || language.toLowerCase() === "auto";
const candidates = ["javascript", "typescript", "python", "json", "xml", "css", "bash", "sql", "yaml", "markdown", "java", "c", "cpp", "csharp", "go", "rust", "ruby", "php", "swift", "kotlin"];

export async function resolveCodeLanguage(code: string, language = "") {
  if (!isAutomaticCodeLanguage(language)) return language;
  const sample = code.slice(0, 20000).trim();
  // Prose can score against language keywords; require some code structure too.
  if (!sample || !/[{}()[\];=<>`#$:|\\]/.test(sample)) return "txt";
  try {
    const { default: detector } = await import("highlight.js/lib/common");
    const result = detector.highlightAuto(sample, candidates.filter(name => name !== "css" || /[{}]|^\s*@[\w-]+/m.test(sample)));
    // Short or ambiguous snippets can remain plain until there is enough evidence.
    if (!result.language || result.relevance < 2) return "txt";
    return result.language === "xml" ? "html" : result.language;
  } catch { return "txt"; }
}
