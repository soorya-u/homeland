import { createWebAuthClient } from "@homeland/auth/client/web";
import { env } from "@homeland/env/web";

export const authClient = createWebAuthClient({
	baseURL: env.VITE_SERVER_URL,
});
