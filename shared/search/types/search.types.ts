export interface SearchResultItem {
  id: string;
  type: "unit" | "person" | "occupancy";
  title: string;
  subtitle: string;
  url: string;
}

export interface GroupedSearchResults {
  units: SearchResultItem[];
  persons: SearchResultItem[];
  occupancies: SearchResultItem[];
}
