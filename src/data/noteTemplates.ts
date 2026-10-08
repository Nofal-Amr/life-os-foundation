/**
 * Ready-made starting points for a note. A template only fills in the new
 * note — it's an ordinary note afterwards, edited like any other.
 */
import { format } from "date-fns";

export type NoteTemplate = {
  id: string;
  label: string;
  title: (now: Date) => string;
  body?: string;
  checklist?: string[];
  tags?: string[];
};

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "daily-plan",
    label: "Daily plan",
    title: (now) => `Plan · ${format(now, "EEE d MMM")}`,
    checklist: ["The one thing that matters most today", "Second thing", "Third thing"],
    tags: ["Plan"],
  },
  {
    id: "meeting",
    label: "Meeting notes",
    title: () => "Meeting: ",
    body: "Who:\n\nWhat was decided:\n\nWhat I have to do:\n\nNext meeting:",
    tags: ["Meeting"],
  },
  {
    id: "weekly-review",
    label: "Weekly review",
    title: (now) => `Week review · ${format(now, "d MMM")}`,
    body: "What went well:\n\nWhat got in the way:\n\nWhat I'll change next week:\n\nThe one thing for next week:",
    tags: ["Review"],
  },
  {
    id: "packing",
    label: "Packing list",
    title: () => "Packing",
    checklist: ["Phone charger", "Wallet and ID", "Keys", "Medicine", "Water bottle"],
    tags: ["Lists"],
  },
  {
    id: "gratitude",
    label: "Gratitude",
    title: (now) => `Grateful · ${format(now, "d MMM")}`,
    body: "Three things I'm grateful for today:\n1. \n2. \n3. \n\nAlhamdulillah for:",
    tags: ["Diary"],
  },
  {
    id: "brain-dump",
    label: "Brain dump",
    title: () => "Brain dump",
    body: "Everything on my mind, no order:\n\n",
    tags: ["Rant"],
  },
];
