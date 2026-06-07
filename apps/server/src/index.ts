import { cors } from "@elysiajs/cors";
import { createContext } from "@homeland/api/context";
import { appRouter } from "@homeland/api/routers/index";
import { auth } from "@homeland/auth";
import { env } from "@homeland/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Elysia } from "elysia";
import { initLogger } from "evlog";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { evlog } from "evlog/elysia";

const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});
const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

initLogger({
	env: { service: "homeland-server" },
});

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
	exclude: ["/api/auth/**"],
	maskEmail: true,
});

new Elysia()
	.use(evlog())
	.derive(async ({ request, log }) => {
		await identifyUser(log, request.headers, new URL(request.url).pathname);
		return {};
	})
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		})
	)
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})
	.all(
		"/rpc*",
		async (context) => {
			const { response } = await rpcHandler.handle(context.request, {
				prefix: "/rpc",
				context: await createContext({ context }),
			});
			return response ?? new Response("Not Found", { status: 404 });
		},
		{
			parse: "none",
		}
	)
	.all(
		"/api-reference*",
		async (context) => {
			const { response } = await apiHandler.handle(context.request, {
				prefix: "/api-reference",
				context: await createContext({ context }),
			});
			return response ?? new Response("Not Found", { status: 404 });
		},
		{
			parse: "none",
		}
	)
	.get("/", () => "OK")
	.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});
