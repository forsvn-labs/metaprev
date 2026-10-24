import { bindings, defineConfig, defineContainer, defineWorker, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

const inspector = defineContainer({
	name: "metaprev-inspector",
	image: { dockerfile: "../../Dockerfile", buildContext: "../.." },
	instanceType: "lite",
	maxInstances: 1,
	ssh: { enabled: false },
	observability: { enabled: true, logs: { enabled: true } },
});

const worker = defineWorker({
		name: "metaprev",
		compatibilityDate: "2026-10-24",
		entrypoint,
		domains: ["metaprev.forsvn.com"],
		assets: {
			htmlHandling: "drop-trailing-slash",
			notFoundHandling: "404-page",
			runWorkerFirst: ["/api/*", "/inspect"],
		},
		exports: { Inspector: exports.durableObject({ storage: "sqlite", container: inspector }) },
		observability: {
			enabled: true,
			redactQueryString: true,
			logs: { enabled: true, headSamplingRate: 0.01 },
			traces: { enabled: true, headSamplingRate: 0.01 },
		},
});

export default defineConfig({
	worker: {
		...worker,
		env: {
			ASSETS: bindings.assets(),
			INSPECTOR: bindings.durableObject({ worker, exportName: "Inspector" }),
		},
	},
	containers: [inspector],
});
