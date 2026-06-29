import * as searchRepository from "../repositories/search.repository";
import { GroupedSearchResults } from "../types/search.types";

export const searchService = {
  async globalSearch(query: string): Promise<GroupedSearchResults> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { units: [], persons: [], occupancies: [] };
    }
    return searchRepository.searchAll(trimmed);
  }
};
