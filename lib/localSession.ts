import { getPrimaryUser, getUserById, createUser, type User } from "./db";

// The app runs locally for a single person — there is no login. Every API
// route still scopes data by `user_id` (documents, collections), so this
// resolves the one local profile and returns it in the same shape the
// routes used to get from NextAuth's getServerSession.
//
// The local profile is the oldest admin (it owns the data created back when
// the app had accounts), falling back to the oldest user, and is created on
// first run of a fresh DB. The multi-user code lives on branch
// archive/multi-user.

export type LocalSession = {
  user: { id: string; name: string; email: string; role: "admin" };
};

let cachedUserId: string | undefined;

function resolveLocalUser(): User {
  if (cachedUserId) {
    const cached = getUserById(cachedUserId);
    if (cached) return cached;
  }
  const user =
    getPrimaryUser() ??
    createUser({ id: crypto.randomUUID(), name: "מקומי", email: "local@localhost", passwordHash: null, role: "admin" });
  cachedUserId = user.id;
  return user;
}

export function getLocalSession(): LocalSession {
  const user = resolveLocalUser();
  return { user: { id: user.id, name: user.name, email: user.email, role: "admin" } };
}
