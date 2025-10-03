import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [preact(), tailwindcss()],

	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},

	server: {
		hmr: {
			overlay: true,
		},
		watch: {
			usePolling: false,
			interval: 100,
		},
	},

	optimizeDeps: {
		include: [
			'preact',
			'preact/compat',
			'preact/hooks',
			'preact-iso',
		],
	},

	build: {
		watch: {},
	},
});
