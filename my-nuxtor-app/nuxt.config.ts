import process from "node:process";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineNuxtConfig({
	runtimeConfig: {
		yandexClientId: process.env.NUXT_YANDEX_CLIENT_ID || "",
		yandexClientSecret: process.env.NUXT_YANDEX_CLIENT_SECRET || "",
		yandexRedirectUri: process.env.NUXT_YANDEX_REDIRECT_URI || "http://localhost:3000/api/auth/yandex/callback",
		strapiOauthPasswordSalt: process.env.NUXT_STRAPI_OAUTH_PASSWORD_SALT || "dev-oauth-salt",
		public: {
			strapiUrl: process.env.NUXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
		}
	},
	modules: [
		"nuxt-auth-utils",
		"@nuxt/eslint"
	],
	css: [
		"@/assets/css/main.css"
	],
	ssr: false,
	vite: {
		clearScreen: false,
		envPrefix: ["VITE_", "TAURI_"],
		plugins: [
			tailwindcss()
		],
		server: {
			strictPort: true,
			hmr: host
				? {
					protocol: "ws",
					host,
					port: 3001
				}
				: undefined,
			watch: {
				ignored: ["**/src-tauri/**"]
			}
		}
	},
	devServer: {
		host: host || "0.0.0.0"
	},
	eslint: {
		config: {
			standalone: false
		}
	},
	devtools: {
		enabled: true
	},
	compatibilityDate: "2026-01-01"
});
