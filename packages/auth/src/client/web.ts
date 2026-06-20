import { createAuthClient } from "better-auth/react";
import { authorizationClientPlugin } from "../plugins/client";

export function createWebAuthClient(config: { baseURL: string }) {
	return createAuthClient({
		baseURL: config.baseURL,
		plugins: [authorizationClientPlugin()],
	});
}
