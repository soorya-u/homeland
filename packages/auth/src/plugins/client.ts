import { getAccessibleModules, MODULES } from "@homeland/db/modules";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { atom } from "nanostores";
import type { authorizationServerPlugin } from "./server";

type PermissionsData = { permissions: string[]; role: string } | null;

export function authorizationClientPlugin() {
	const $permissions = atom<PermissionsData>(null);

	return {
		id: "authorization",
		$InferServerPlugin: {} as ReturnType<typeof authorizationServerPlugin>,

		getAtoms: () => ({ $permissions }),

		getActions: ($fetch) => ({
			fetchPermissions: async () => {
				const res = await $fetch("/permissions", { method: "GET" });
				if (res.data) {
					$permissions.set(res.data as { permissions: string[]; role: string });
				}
				return res;
			},

			hasAccess: (permission: string): boolean => {
				const data = $permissions.get();
				if (!data) {
					return false;
				}
				if (data.role === "admin") {
					return true;
				}
				return data.permissions.includes(permission);
			},

			getAccessibleModules: (): { slug: string; name: string }[] => {
				const data = $permissions.get();
				if (!data) {
					return [];
				}
				if (data.role === "admin") {
					return Object.values(MODULES).map((mod) => ({
						slug: mod.slug,
						name: mod.name,
					}));
				}
				return getAccessibleModules(data.permissions);
			},
		}),
	} satisfies BetterAuthClientPlugin;
}
