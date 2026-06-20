import { join } from "node:path";
import { config as dotenvConfig } from "@dotenvx/dotenvx";
import { opentelemetry } from "@elysia/opentelemetry";
import { serverTiming } from "@elysia/server-timing";
import { cors } from "@elysiajs/cors";
import { createContext } from "@homeland/api/context";
import { appRouter } from "@homeland/api/routers/index";
import { createAuth } from "@homeland/auth";
import { initEnforcer } from "@homeland/auth/casbin";
import { env } from "@homeland/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Elysia } from "elysia";
import { csrf } from "elysia-csrf";
import { helmet } from "elysia-helmet";
import { rateLimit } from "elysia-rate-limit";
import { initLogger, log } from "evlog";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { evlog } from "evlog/elysia";
import { withEvlog } from "evlog/orpc";

dotenvConfig({ path: join(import.meta.dirname, "../.env") });

const enforcer = await initEnforcer();
const auth = createAuth(enforcer);

const rpcHandler = withEvlog(new RPCHandler(appRouter));

const apiHandler = withEvlog(
	new OpenAPIHandler(appRouter, {
		plugins: [
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
			}),
		],
	})
);

initLogger({
	env: { service: "homeland/bff" },
});

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
	exclude: ["/api/auth/**"],
	maskEmail: true,
});

new Elysia()
	.decorate("enforcer", enforcer)
	.use(opentelemetry({ serviceName: "homeland/bff" }))
	.use(helmet())
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
			credentials: true,
		})
	)
	.use(
		rateLimit({
			max: 100,
			duration: 60_000,
			skip: (request) => new URL(request.url).pathname.startsWith("/docs"),
		})
	)
	.use(serverTiming())
	.use(evlog())
	.derive(async ({ request, log }) => {
		await identifyUser(log, request.headers, new URL(request.url).pathname);
		return {};
	})
	.use(
		csrf({
			cookie: true,
			value: (ctx) => {
				const path = new URL(ctx.request.url).pathname;
				const origin = ctx.request.headers.get("origin");
				if (path.startsWith("/api/auth/") || !origin) {
					return ctx.cookie?._csrf?.value;
				}
				return (
					ctx.request.headers.get("x-csrf-token") ||
					ctx.request.headers.get("csrf-token") ||
					ctx.request.headers.get("xsrf-token") ||
					ctx.request.headers.get("x-xsrf-token")
				);
			},
		})
	)
	.all("/api/auth/*", (context) => {
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
				context: await createContext({
					context,
					auth,
					enforcer: context.enforcer,
				}),
			});
			return response ?? new Response("Not Found", { status: 404 });
		},
		{
			parse: "none",
		}
	)
	.all(
		"/docs*",
		async (context) => {
			const { response } = await apiHandler.handle(context.request, {
				prefix: "/docs",
				context: await createContext({
					context,
					auth,
					enforcer: context.enforcer,
				}),
			});
			return response ?? new Response("Not Found", { status: 404 });
		},
		{
			parse: "none",
		}
	)
	.get("/", () => "OK")
	.listen(3000, () => {
		log.info("bff", "Server is running on http://localhost:3000");
	});
