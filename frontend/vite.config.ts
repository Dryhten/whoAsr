import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [preact(), tailwindcss(), basicSsl()],

	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},

	server: {
		https: true,
		host: true,
		proxy: {
			'/model': { target: 'http://localhost:8000', ws: true },
			'/offline': 'http://localhost:8000',
			'/punctuation': 'http://localhost:8000',
			'/vad': { target: 'http://localhost:8000', ws: true },
			'/timestamp': 'http://localhost:8000',
			'/health': 'http://localhost:8000',
			'/ws': { target: 'http://localhost:8000', ws: true },
			'/realtime-nano': { target: 'http://localhost:8000', ws: true },
			'/docs': 'http://localhost:8000',
			'/openapi.json': 'http://localhost:8000',
		},
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

	});
