import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	// 从项目根目录 .env 读取后端端口
	const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
	const apiPort = env.PORT || '8000'
	const apiTarget = `http://localhost:${apiPort}`

	return {
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
				'/model': { target: apiTarget, ws: true, changeOrigin: true },
				'/offline': apiTarget,
				'/punctuation': apiTarget,
				'/vad': { target: apiTarget, ws: true, changeOrigin: true },
				'/timestamp': apiTarget,
				'/health': apiTarget,
				'/ws': { target: apiTarget, ws: true, changeOrigin: true },
				'/realtime-nano': { target: apiTarget, ws: true, changeOrigin: true },
				'/docs': apiTarget,
				'/openapi.json': apiTarget,
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
	}
})
