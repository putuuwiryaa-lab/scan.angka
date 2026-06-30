import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scan Angka",
    short_name: "Scan Angka",
    description: "Aplikasi scan praktis dengan fitur Batch Scan dalam satu tempat.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#6e9bff",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
