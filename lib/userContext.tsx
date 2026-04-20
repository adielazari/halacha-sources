"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type UserContextType = {
  currentUser: string;
  setCurrentUser: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  currentUser: "anonymous",
  setCurrentUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage synchronously on the client so the
  // correct user is available on the very first render — no second-render flash.
  const [currentUser, setCurrentUserState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("currentUser") ?? "anonymous";
    }
    return "anonymous";
  });

  const setCurrentUser = useCallback((name: string) => {
    localStorage.setItem("currentUser", name);
    setCurrentUserState(name);
  }, []);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
