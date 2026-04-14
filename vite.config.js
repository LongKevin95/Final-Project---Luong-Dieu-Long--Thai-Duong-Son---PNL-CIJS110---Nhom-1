import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  base: "/Final-Project---Luong-Dieu-Long--Thai-Duong-Son---PNL-CIJS110---Nhom-1/",
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
});
