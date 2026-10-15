// English UI copy, same shape as the Azerbaijani catalogue. Data coming from the
// API (area names, competition titles, notifications) stays in Azerbaijani.

import type { Messages } from "./az";

export const en: Messages = {
  app: {
    name: "Agricultural Investment Portal",
    prototype: "Prototype",
    description: "Investment competition portal for agricultural land in the territories liberated from occupation"
  },
  nav: {
    map: "Map",
    catalogue: "Catalogue",
    competitions: "Competitions",
    about: "About",
    signIn: "Sign in",
    signOut: "Sign out",
    cabinet: "My account",
    admin: "Administration",
    language: "Language"
  },
  status: {
    DRAFT: "Draft",
    RECEIVED: "Received",
    UNDER_REVIEW: "Under review",
    INFO_REQUESTED: "Information requested",
    DECIDED: "Decided"
  },
  statusHint: {
    DRAFT: "The application has not been submitted yet",
    RECEIVED: "The application is registered and queued",
    UNDER_REVIEW: "A specialist is reviewing the application",
    INFO_REQUESTED: "The specialist asked for more information or documents",
    DECIDED: "A decision has been made"
  },
  outcome: {
    WON: "Winner",
    REJECTED: "Rejected"
  },
  purpose: {
    CROP: "Crop farming",
    LIVESTOCK: "Livestock",
    ORCHARD: "Orchards",
    OTHER: "Other"
  },
  suitability: {
    title: "Suitability",
    decisionSupport: "Decision support",
    finalDecision: "The final decision is made by the commission",
    S1: "Highly suitable",
    S2: "Moderately suitable",
    S3: "Marginally suitable",
    N: "Not suitable"
  },
  common: {
    demoData: "Demo data",
    loading: "Loading…",
    error: "Something went wrong",
    retry: "Try again",
    details: "Details",
    back: "Back",
    continue: "Continue",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    search: "Search",
    hectares: "ha",
    daysLeft: "days left",
    deadlinePassed: "Deadline passed"
  }
};
