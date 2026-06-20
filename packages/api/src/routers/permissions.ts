import { ORPCError } from "@orpc/server";
import z from "zod";

import { protectedProcedure } from "../index";

function requireAdmin(role: string) {
	if (role !== "admin") {
		throw new ORPCError("FORBIDDEN", {
			message: "Admin access required",
		});
	}
}

export const permissionsRouter = {
	grant: protectedProcedure
		.route({ method: "POST", path: "/permissions", successStatus: 201 })
		.input(
			z.object({
				userId: z.string().min(1),
				permission: z.string().min(1),
			})
		)
		.handler(async ({ input, context }) => {
			requireAdmin(context.session.user.role as string);
			await context.enforcer.addPolicy(input.userId, input.permission, "allow");
			return { success: true };
		}),

	revoke: protectedProcedure
		.route({ method: "DELETE", path: "/permissions", successStatus: 204 })
		.input(
			z.object({
				userId: z.string().min(1),
				permission: z.string().min(1),
			})
		)
		.handler(async ({ input, context }) => {
			requireAdmin(context.session.user.role as string);
			await context.enforcer.removePolicy(
				input.userId,
				input.permission,
				"allow"
			);
			return { success: true };
		}),

	list: protectedProcedure
		.route({ method: "GET", path: "/permissions" })
		.input(z.object({ userId: z.string().min(1) }))
		.handler(async ({ input, context }) => {
			const role = context.session.user.role as string;
			if (role !== "admin" && context.session.user.id !== input.userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "Can only view your own permissions",
				});
			}
			const policies = await context.enforcer.getFilteredPolicy(
				0,
				input.userId
			);
			const permissions = policies.map((p) => p[1]);
			return { permissions, role };
		}),
};
