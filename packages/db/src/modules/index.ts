export type Tier = "read" | "write" | "delete" | "share";
export type OwnershipModel = "admin-owned" | "creator-owned";
export type ShareRole = "viewer" | "editor";

interface PermissionWithoutTier {
	string: string;
}
interface PermissionWithTier {
	string: string;
	tier: Tier;
}

type CreatorOwnedPermissions = {
	read: { string: string; tier: "read" };
	write: { string: string; tier: "write" };
	delete: { string: string; tier: "delete" };
	share: { string: string; tier: "share" };
} & Record<string, PermissionWithTier | PermissionWithoutTier>;

type AdminOwnedPermissions = Record<string, PermissionWithoutTier>;

type Entity =
	| {
			ownershipModel: "creator-owned";
			shareRoles: readonly ShareRole[];
			permissions: CreatorOwnedPermissions;
	  }
	| {
			ownershipModel: "admin-owned";
			permissions: AdminOwnedPermissions;
	  };

interface Module {
	entities: Record<string, Entity>;
	name: string;
	slug: string;
}

type ModuleCatalog = Record<string, Module>;

export const MODULES = {
	audio: {
		name: "Audio",
		slug: "audio",
		entities: {
			track: {
				ownershipModel: "creator-owned",
				shareRoles: ["viewer"],
				permissions: {
					read: { string: "track:read", tier: "read" },
					write: { string: "track:write", tier: "write" },
					delete: { string: "track:delete", tier: "delete" },
					share: { string: "track:share", tier: "share" },
					upload: { string: "track:upload" },
				},
			},
			playlist: {
				ownershipModel: "creator-owned",
				shareRoles: ["viewer", "editor"],
				permissions: {
					read: { string: "playlist:read", tier: "read" },
					write: { string: "playlist:write", tier: "write" },
					delete: { string: "playlist:delete", tier: "delete" },
					share: { string: "playlist:share", tier: "share" },
				},
			},
		},
	},
	streaming: {
		name: "Streaming",
		slug: "streaming",
		entities: {
			video: {
				ownershipModel: "admin-owned",
				permissions: {
					watch: { string: "video:watch" },
				},
			},
		},
	},
	photos: {
		name: "Photos",
		slug: "photos",
		entities: {
			image: {
				ownershipModel: "creator-owned",
				shareRoles: ["viewer"],
				permissions: {
					read: { string: "image:read", tier: "read" },
					write: { string: "image:write", tier: "write" },
					delete: { string: "image:delete", tier: "delete" },
					share: { string: "image:share", tier: "share" },
					upload: { string: "image:upload" },
				},
			},
			album: {
				ownershipModel: "creator-owned",
				shareRoles: ["viewer", "editor"],
				permissions: {
					read: { string: "album:read", tier: "read" },
					write: { string: "album:write", tier: "write" },
					delete: { string: "album:delete", tier: "delete" },
					share: { string: "album:share", tier: "share" },
				},
			},
		},
	},
	iot: {
		name: "IoT",
		slug: "iot",
		entities: {
			device: {
				ownershipModel: "admin-owned",
				permissions: {
					read: { string: "device:read" },
					toggle: { string: "device:toggle" },
				},
			},
		},
	},
	cctv: {
		name: "CCTV",
		slug: "cctv",
		entities: {
			camera: {
				ownershipModel: "admin-owned",
				permissions: {
					read: { string: "camera:read" },
					detect: { string: "camera:detect" },
				},
			},
		},
	},
} as const satisfies ModuleCatalog;

export const ENTITY_TYPE_TO_MODULE: Record<string, string> = Object.fromEntries(
	Object.entries(MODULES).flatMap(([slug, mod]) =>
		Object.keys(mod.entities).map((entityType) => [entityType, slug])
	)
);

const _entityTypeSet = new Set<string>();
for (const [slug, mod] of Object.entries(MODULES)) {
	for (const entityType of Object.keys(mod.entities)) {
		if (_entityTypeSet.has(entityType)) {
			throw new Error(
				`Duplicate entity type "${entityType}" in module "${slug}" — entity type names must be globally unique across all modules`
			);
		}
		_entityTypeSet.add(entityType);
	}
}

export function getAccessibleModules(permissions: string[]): {
	slug: string;
	name: string;
}[] {
	const moduleSlugs = new Set<string>();
	for (const perm of permissions) {
		const entityType = perm.split(":")[0];
		if (!entityType) {
			continue;
		}
		const slug = ENTITY_TYPE_TO_MODULE[entityType];
		if (slug) {
			moduleSlugs.add(slug);
		}
	}
	return [...moduleSlugs].map((slug) => ({
		slug,
		name: MODULES[slug as keyof typeof MODULES].name,
	}));
}

export function getEntityMetadata(permission: string):
	| {
			ownershipModel: OwnershipModel;
			tier: Tier | undefined;
			shareRoles: readonly ShareRole[] | undefined;
	  }
	| undefined {
	const [entityType, action] = permission.split(":");
	if (!(entityType && action)) {
		return;
	}
	for (const mod of Object.values(MODULES)) {
		const entities = mod.entities as Record<string, Entity>;
		const entity = entities[entityType];
		if (entity) {
			const perms = entity.permissions as Record<string, { tier?: Tier }>;
			const perm = perms[action];
			return {
				ownershipModel: entity.ownershipModel,
				tier: perm?.tier,
				shareRoles:
					entity.ownershipModel === "creator-owned"
						? entity.shareRoles
						: undefined,
			};
		}
	}
	return;
}
