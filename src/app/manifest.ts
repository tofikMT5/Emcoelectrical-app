import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EMCO ELECTRICAL - Motor Winding Data",
    short_name: "EMCO Electrical",
    description: "Workshop management system for electric motor winding data",
    start_url: "/",
    display: "standalone",
    background_color: "#0f2338",
    theme_color: "#1466b8",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
