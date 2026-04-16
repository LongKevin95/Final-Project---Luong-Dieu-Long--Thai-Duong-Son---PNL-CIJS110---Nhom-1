import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

const githubPagesBase =
  "/Final-Project---Luong-Dieu-Long--Thai-Duong-Son---PNL-CIJS110---Nhom-1/";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? githubPagesBase : "/",
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
}));
