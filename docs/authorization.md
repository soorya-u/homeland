# Authorization — How It Works (Concise Reference)

## 1. User Types

| Type | Default access | How enforced |
|---|---|---|
| `admin` | Everything | Short-circuit at top of `authorize()` — returns `true` before any Casbin call |
| `user` | Nothing | Every permission must be explicitly granted via `casbin_rule` `p` policy |

```typescript
if (user.role === "admin") return true;  // skip Casbin entirely
```

**Example:** Admin opens any module, any entity → always allowed. User opens audio → denied unless admin granted `track:read`.

---

## 2. Hierarchy: Module > Entity Type > Permission

```
audio (module)
├── track (entity type)
│   ├── track:read   (tier: read)
│   ├── track:write  (tier: write)
│   ├── track:delete (tier: delete)
│   ├── track:share  (tier: share)
│   └── track:upload (no tier)
└── playlist (entity type)
    ├── playlist:read   (tier: read)
    └── ...
```

- **Module** — organizational only. Never appears in permission strings or authz logic.
- **Entity type** — unit of authorization. Has ownership model + share roles + permissions.
- **Permission** — `"entityType:action"` string (e.g., `track:read`, `video:watch`).

**Example:** `audio` module contains `track` and `playlist` entity types. User with `track:read` can read tracks but not playlists unless they also have `playlist:read`.

---

## 3. Ownership Models

### admin-owned
- Admin creates entities. All users with the permission access all entities.
- No sharing, no `entity_user_association` rows, no tiers.
- Any action name (`watch`, `toggle`, `detect`).

**Example:** Streaming module. Admin uploads videos. User with `video:watch` can watch every video. No per-video sharing.

### creator-owned
- Users create entities. Creator is the **owner** (`owner_id` on entity table).
- Owner can share (as allowed by `shareRoles`) or make public.
- MUST have `read`/`write`/`delete`/`share` permissions with tiers.

**Example:** Audio module. User A uploads track #123 → `owner_id = user_a`. User A owns it. User B (has `track:read`) cannot see track #123 unless it's public or shared with them.

---

## 4. Share Roles (per entity type)

| Role | Can do | Defined where |
|---|---|---|
| `viewer` | Read (tier: read) | `shareRoles` in catalog |
| `editor` | Read + write (tier: read + write) | `shareRoles` in catalog |
| *(owner)* | Everything | `owner_id` on entity table — NOT a share role |

**Example:**
- `track` → `shareRoles: ["viewer"]` — tracks can only be shared read-only. The share API rejects `editor` for tracks.
- `playlist` → `shareRoles: ["viewer", "editor"]` — playlists can be shared with edit access.

---

## 5. Tiers

| Tier | Who passes | Enforced by |
|---|---|---|
| `read` | owner, public viewers, shared viewers, shared editors | `hasShare(allShares, user)` |
| `write` | owner, shared editors | `hasShare(editorShares, user)` |
| `delete` | owner only | `r.obj.owner == r.sub` in matcher |
| `share` | owner only | `r.obj.owner == r.sub` in matcher |
| *(none)* | Anyone with IAM permission | IAM check only, no entity check |

**Example:** User B is shared on track #123 as `viewer`.
- `track:read` + entity #123 → passes (viewer in `allShares`, tier `read` matches)
- `track:write` + entity #123 → fails (viewer not in `editorShares`, tier `write` doesn't match)
- `track:delete` + entity #123 → fails (not owner)

---

## 6. Authorization Techniques (composed)

| Technique | Where | What it decides |
|---|---|---|
| Role check | `authorize()` top | Is user admin? → allow everything |
| RBAC | `casbin_rule` `p` policies | Does user have `track:read` at all? (type-level) |
| ACL | `entity_user_association` | Is user shared on *this* entity? (entity-level) |
| ABAC | Casbin matcher | Is user the owner? Is entity public? (attribute-based) |

**One `enforce()` call** evaluates all four via the Casbin matcher.

**Example:** User B tries to read track #123.
1. Role check: not admin → continue
2. RBAC: `casbin_rule` has `p, user_b, track:read, allow` → passes
3. ABAC: `owner_id == user_b`? No. `is_public`? No.
4. ACL: `entity_user_association` has `(track, 123, user_b, viewer)` → `allShares` includes `user_b`, tier `read` matches → **allow**

---

## 7. The Matcher (single source of truth)

```conf
m = p(r.sub, r.permission, "allow")
  && (
    r.obj.isEntity == false                                    // type-level action (upload)
    || r.obj.ownershipModel == "admin-owned"                   // admin-owned: any user with perm
    || r.obj.owner == r.sub                                    // owner: full control
    || (r.obj.isPublic == true && r.tier == "read")           // public: read only
    || (r.tier == "read"  && hasShare(r.obj.allShares, r.sub))    // shared viewer/editor
    || (r.tier == "write" && hasShare(r.obj.editorShares, r.sub)) // shared editor
  )
```

**How to read it:** IAM check (`p(...)`) MUST pass. THEN any one entity-check branch must pass. Delete/share tiers have no explicit branch — they pass only via `r.obj.owner == r.sub`.

**Change rules by editing this file** — no code changes. Examples:
- "Editors can delete" → add `|| (r.tier == "delete" && hasShare(r.obj.editorShares, r.sub))`
- "Public entities are writable" → change `r.tier == "read"` to `r.tier in ["read", "write"]`

---

## 8. Decision Flow per Request

```
Request comes in with (userId, userRole, permission, entity?)

1. userRole == "admin"?
   → YES: return true (done)
   → NO: continue

2. Look up entity metadata from catalog (ownershipModel, tier)

3. No entity provided? (e.g., track:upload)
   → Casbin: IAM check only (isEntity: false short-circuits entity check)
   → done

4. Entity is admin-owned? (e.g., video:watch)
   → Casbin: IAM check + admin-owned short-circuit (no association query)
   → done

5. Entity is creator-owned? (e.g., track:read + track #123)
   → Query entity_user_association for (entity_type, entity_id)
   → Build share sets: allShares (viewer+editor), editorShares (editor only)
   → Casbin: IAM check + ownership/public/sharing check
   → done
```

---

## 9. Worked Examples

### Example A: Admin watches any video
```
authorize(admin, "video:watch", video#1)
→ admin short-circuit → true
```

### Example B: User watches admin-owned video (has permission)
```
authorize(user_b, "video:watch", video#1)
→ IAM: casbin_rule has p, user_b, video:watch, allow → true
→ Entity: ownershipModel == "admin-owned" → true
→ RESULT: allow
```

### Example C: User watches admin-owned video (no permission)
```
authorize(user_c, "video:watch", video#1)
→ IAM: no p policy for user_c + video:watch → false
→ RESULT: deny (no Casbin entity check needed)
```

### Example D: Owner reads their own track
```
authorize(user_a, "track:read", track#123, ownerId=user_a)
→ IAM: p, user_a, track:read, allow → true
→ Entity: r.obj.owner == r.sub (user_a == user_a) → true
→ RESULT: allow
```

### Example E: Shared viewer reads track
```
authorize(user_b, "track:read", track#123, ownerId=user_a)
→ IAM: p, user_b, track:read, allow → true
→ Entity: owner != user_b, not public
→ ACL: entity_user_association has (track, 123, user_b, viewer)
→ allShares includes user_b, tier == "read" → true
→ RESULT: allow
```

### Example F: Shared viewer tries to write track
```
authorize(user_b, "track:write", track#123, ownerId=user_a)
→ IAM: p, user_b, track:write, allow → true (if granted)
→ Entity: owner != user_b, not public
→ ACL: user_b is viewer, not in editorShares
→ tier == "write" && hasShare(editorShares, user_b) → false
→ No other branch matches
→ RESULT: deny
```

### Example G: Non-owner tries to delete
```
authorize(user_b, "track:delete", track#123, ownerId=user_a)
→ IAM: p, user_b, track:delete, allow → true (if granted)
→ Entity: owner != user_b
→ No tier branch for "delete" → only owner passes via r.obj.owner == r.sub
→ RESULT: deny
```

### Example H: User uploads a track (type-level action)
```
authorize(user_a, "track:upload")  // no entity
→ IAM: p, user_a, track:upload, allow → true
→ Entity: isEntity == false → true
→ RESULT: allow (no entity to check — creating a new one)
```

### Example I: User with module access but no shares sees empty list
```
authorize(user_b, "track:read", track#123, ownerId=user_a)
→ IAM: p, user_b, track:read, allow → true
→ Entity: owner != user_b, not public, no association rows
→ allShares is empty, editorShares is empty
→ No branch matches
→ RESULT: deny
// User B can use the audio module but sees no tracks until shared or made public
```

### Example J: Public track read by any user with permission
```
authorize(user_c, "track:read", track#456, ownerId=user_a, isPublic=true)
→ IAM: p, user_c, track:read, allow → true
→ Entity: isPublic == true && tier == "read" → true
→ RESULT: allow
```

---

## 10. Cascade Sharing (at share time, not query time)

The authz engine treats each entity independently. Relationships (playlist contains tracks) are handled by the share router when sharing, not by the authz engine when checking.

```
User A shares playlist #42 with User B as editor
  → share router inserts: (playlist, 42, user_b, editor)
  → share router also inserts: (track, T1, user_b, viewer)  ← for each track in playlist
  → share router also inserts: (track, T2, user_b, viewer)
  → share router also inserts: (track, T3, user_b, viewer)
```

Rules:
- Contained role is always bounded by the child's `shareRoles`. Track has `["viewer"]` → cascaded track shares are always `viewer`, even if playlist share is `editor`.
- On add/remove track to/from playlist, share router updates cascaded track shares.
- On unshare, share router removes cascaded shares (unless access exists via another container).
- Admin-owned entities never cascade (no sharing).

**Why at share time:** keeps `authorize()` flat (one entity, one check, no relationship traversal). The authz engine never needs to know that playlists contain tracks.

---

## 11.
Helpers (UI only, not enforcement)

```typescript
// Does user have this permission? (admin always true)
authClient.hasAccess("track:upload")  // → true/false

// Which modules can user access? (admin gets all)
authClient.getAccessibleModules()
// → [{ slug: "audio", name: "Audio" }, { slug: "streaming", name: "Streaming" }]
```

**Server-side `authorize()` is the real enforcement.** Client helpers only drive UI (show/hide buttons, home page module grid).

---

## 12. Compile-Time Catalog Validation

```typescript
} as const satisfies ModuleCatalog;
```

TypeScript catches at compile time (in your IDE, before running):
- Creator-owned entity missing `read`/`write`/`delete`/`share` → type error
- Creator-owned entity missing `shareRoles` → type error
- Admin-owned entity with a `tier` on any permission → type error

**Example:** Add a creator-owned entity without `delete`:
```typescript
foo: {
  ownershipModel: "creator-owned",
  shareRoles: ["viewer"],
  permissions: {
    read: { string: "foo:read", tier: "read" },
    // delete missing
  },
}
// → TS error: Property 'delete' is missing in type ...
```
