import { db } from "@homeland/db";
import { getEntityMetadata } from "@homeland/db/modules";
import { getEntityShares } from "@homeland/db/repositories/entity";
import { casbinRule } from "@homeland/db/schema";
import type { Enforcer } from "casbin";
import { newEnforcer } from "casbin";
import DrizzleAdapter from "drizzle-adapter";

export type { Enforcer } from "casbin";

export async function initEnforcer(): Promise<Enforcer> {
	const adapter = await DrizzleAdapter.newAdapter({
		db,
		table: casbinRule,
	});
	const e = await newEnforcer(
		new URL("./policies/authorization.conf", import.meta.url).pathname,
		adapter
	);
	await e.loadPolicy();
	e.enableAutoSave(true);

	e.addFunction("hasShare", (shares: unknown, userId: unknown) => {
		if (!Array.isArray(shares) || typeof userId !== "string") {
			return false;
		}
		return shares.includes(userId);
	});
	return e;
}

export interface EntityInput {
	id: string;
	isPublic: boolean;
	ownerId: string;
	type: string;
}

export interface AuthorizeParams {
	enforcer: Enforcer;
	entity?: EntityInput;
	permission: string;
	userId: string;
	userRole: "admin" | "user";
}

export async function authorize(params: AuthorizeParams): Promise<boolean> {
	if (params.userRole === "admin") {
		return true;
	}

	const e = params.enforcer;
	const meta = getEntityMetadata(params.permission);
	const tier = meta?.tier ?? "";

	if (!params.entity) {
		return e.enforce(
			params.userId,
			params.permission,
			{ isEntity: false },
			tier
		);
	}

	if (meta?.ownershipModel === "admin-owned") {
		return e.enforce(
			params.userId,
			params.permission,
			{ isEntity: true, ownershipModel: "admin-owned" },
			tier
		);
	}

	const associations = await getEntityShares(
		params.entity.type,
		params.entity.id
	);

	const allShares = associations.map((a) => a.userId);
	const editorShares = associations
		.filter((a) => a.role === "editor")
		.map((a) => a.userId);

	const entityObj = {
		isEntity: true,
		ownershipModel: "creator-owned" as const,
		owner: params.entity.ownerId,
		isPublic: params.entity.isPublic,
		allShares,
		editorShares,
	};

	return e.enforce(params.userId, params.permission, entityObj, tier);
}
