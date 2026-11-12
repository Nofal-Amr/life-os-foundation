/**
 * Details the privacy policy and terms show. The owner fills these in before
 * the pages go live; until then the pages say plainly that they're a draft.
 */
export const LEGAL = {
  /** Who runs Life OS (a person or a company), as it should appear publicly. */
  operator: "",
  /** Where people write about privacy, data requests or the terms. */
  contactEmail: "",
  /** The minimum age to use Life OS. */
  minimumAge: 16,
  /** The law the terms are under. */
  governingLaw: "the Arab Republic of Egypt",
  /** The date this version of the texts took effect (YYYY-MM-DD). */
  effective: "",
} as const;

export const LEGAL_DRAFT = !LEGAL.operator || !LEGAL.contactEmail || !LEGAL.effective;
