// Gera os ícones da PWA a partir de um SVG simples, com as cores do design system.
import sharp from "sharp";
const svg = (size, pad) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="#090B0B"/><path d="M${50} ${pad}L${100 - pad} ${100 - pad}H${72 - pad * 0.2}L50 ${pad + 34}L${28 + pad * 0.2} ${100 - pad}H${pad}Z" fill="#B6FF32"/></svg>`);
for (const [name, size, pad] of [["icon-192", 192, 18], ["icon-512", 512, 18], ["icon-maskable-512", 512, 28], ["apple-touch-icon", 180, 18]]) {
  await sharp(svg(size, pad)).png().toFile(`public/icons/${name}.png`);
}
console.log("Ícones gerados.");
