"use client";

import { createContext, useContext } from "react";

import { az, type Messages } from "@/messages/az";

const MessagesContext = createContext<Messages>(az);

export function MessagesProvider({
  messages = az,
  children
}: {
  messages?: Messages;
  children: React.ReactNode;
}) {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}

/** Returns the active message catalogue (Azerbaijani by default). */
export function useT(): Messages {
  return useContext(MessagesContext);
}
