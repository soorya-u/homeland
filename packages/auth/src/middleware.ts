import type { Enforcer } from "casbin";

import type { EntityInput } from "./casbin";
import { authorize } from "./casbin";

export type { EntityInput } from "./casbin";

export function createAuthorize(
	enforcer: Enforcer,
	userId: string,
	userRole: "admin" | "user"
): (permission: string, entity?: EntityInput) => Promise<boolean> {
	return (permission: string, entity?: EntityInput) =>
		authorize({ enforcer, userId, userRole, permission, entity });
}
