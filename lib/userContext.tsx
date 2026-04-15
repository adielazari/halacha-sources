"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserContextType = {
  currentUser: string;
  setCurrentUser: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  currentUser: "anonymous",
  setCurrentUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState("anonymous");

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (stored) setCurrentUserState(stored);
  }, []);

  function setCurrentUser(name: string) {
    localStorage.setItem("currentUser", name);
    setCurrentUserState(name);
  }

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
