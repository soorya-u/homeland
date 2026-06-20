import type { AppRouterClient } from "@homeland/api/routers/index";
import { env } from "@homeland/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const CSRF_COOKIE_PATTERN = /(?:^|;\s*)_csrf=([^;]+)/;

function getCsrfToken(): string | undefined {
	const match = document.cookie.match(CSRF_COOKIE_PATTERN);
	return match?.[1];
}

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				toast.error(`Error: ${error.message}`, {
					action: {
						label: "retry",
						onClick: () => {
							query.invalidate();
						},
					},
				});
			},
		}),
	});
}

export const queryClient = createQueryClient();

export const link = new RPCLink({
	url: `${env.VITE_SERVER_URL}/rpc`,
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
	headers() {
		const csrfToken = getCsrfToken();
		return csrfToken ? { "x-csrf-token": csrfToken } : {};
	},
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
