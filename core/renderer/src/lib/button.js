// Shared by settings, the preview bridge, and the published renderer.
// Keep self-contained so the preview can embed this function.
export function buttonColors(value, accent) {
    const background = [value, accent].find((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) ?? "#111111";
    const channels = [1, 3, 5].map(offset => {
        const channel = parseInt(background.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return { background, text: (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff" };
}
