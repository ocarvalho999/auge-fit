import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Auge Fit",
    short_name: "Auge Fit",
    description: "Registre cada treino e enxergue sua evolução.",
    start_url: "/inicio",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090B0B",
    theme_color: "#090B0B",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
