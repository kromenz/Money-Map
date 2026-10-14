import api from "../lib/api";
import type { NoteSuggestion } from "../types/notes";

export async function fetchNotes(): Promise<NoteSuggestion[]> {
  const { data } = await api.get<{ notes: NoteSuggestion[] }>("/budget/notes");
  return data.notes;
}
