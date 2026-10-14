// Domain codes shared with the API. Codes are ASCII; the Azerbaijani labels
// live in the message catalogue (src/messages).

export const APPLICATION_STATUSES = [
  "DRAFT",
  "RECEIVED",
  "UNDER_REVIEW",
  "INFO_REQUESTED",
  "DECIDED"
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const OUTCOMES = ["WON", "REJECTED"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const PURPOSES = ["CROP", "LIVESTOCK", "ORCHARD", "OTHER"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const FAO_CLASSES = ["S1", "S2", "S3", "N"] as const;
export type FaoClass = (typeof FAO_CLASSES)[number];
