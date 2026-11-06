// The same small CSS vocabulary is used by the editor and the safe preview.
// Never pass arbitrary author CSS through the preview sanitizer.
export function textStyles(style: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof style !== "string") return result;
  for (const declaration of style.split(";")) {
    const [property, ...parts] = declaration.split(":");
    const name = property.trim().toLowerCase(), value = parts.join(":").trim().toLowerCase();
    if (name === "text-align" && /^(left|center|right)$/.test(value)) result[name] = value;
    if (["color", "background-color"].includes(name) &&
      (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/.test(value) ||
       /^(?:rgb|hsl)a?\([\d.% ,/+-]+\)$/.test(value) ||
       /^(?:black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|transparent|inherit|currentcolor)$/.test(value))) result[name] = value;
  }
  return result;
}

export function textStyleString(style: unknown) {
  return Object.entries(textStyles(style)).map(([property, value]) => `${property}: ${value}`).join("; ");
}
