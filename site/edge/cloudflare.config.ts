import { bindings, defineConfig, defineWorker } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

const worker = defineWorker({
		name: "metaprev-free",
		compatibilityDate: "2026-10-24",
		entrypoint,
		domains: ["metaprev.forsvn.com"],
		assets: {
			htmlHandling: "drop-trailing-slash",
			notFoundHandling: "404-page",
			runWorkerFirst: ["/api/*", "/inspect"],
		},
		observability: {
			enabled: true,
			redactQueryString: true,
			logs: { enabled: false },
			traces: { enabled: false },
		},
});

export default defineConfig({
	worker: {
		...worker,
		env: {
			ASSETS: bindings.assets(),
		},
	},
});
