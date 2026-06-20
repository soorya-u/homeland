import { createAuthorize } from "@homeland/auth/middleware";
import { ORPCError, os } from "@orpc/server";
import { evlog } from "evlog/orpc";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o.use(evlog());

const requireAuth = o.middleware(({ context, next }) => {
	const session = context.session;
	if (!session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			session,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);

const requireAuthAndAuthorize = o.middleware(({ context, next }) => {
	const session = context.session;
	if (!session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			session,
			authorize: createAuthorize(
				context.enforcer,
				session.user.id,
				session.user.role as "admin" | "user"
			),
		},
	});
});

export const authorizedProcedure = publicProcedure.use(requireAuthAndAuthorize);
