import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";

export default defineConfig(({ command }) => {
	if (command === "build") execFileSync("bun", ["../scripts/static.ts"], { stdio: "inherit" });
	return { plugins: [cloudflare()] };
});
