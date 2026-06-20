import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { permissionsRouter } from "./permissions";
import { shareRouter } from "./share";

export const appRouter = {
	health: publicProcedure
		.route({ method: "GET", path: "/health" })
		.handler(() => "OK"),
	permissions: permissionsRouter,
	share: shareRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
