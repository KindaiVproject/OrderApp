import type { MetadataRoute } from "next";

// Makes the site installable as a real (standalone) app on Android Chrome
// instead of a browser shortcut that keeps Chrome's toolbar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "注文管理",
    short_name: "注文管理",
    description: "学祭オーダー管理システム",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "ja",
    background_color: "#f2f2f3",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
