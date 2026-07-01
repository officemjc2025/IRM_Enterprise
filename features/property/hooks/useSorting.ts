import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function useSorting(defaultSortBy = "code", defaultSortOrder: "asc" | "desc" = "asc") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortBy = searchParams.get("sortBy") || defaultSortBy;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || defaultSortOrder;

  const setSorting = (columnKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (sortBy === columnKey) {
      // Toggle direction: ASC -> DESC -> ASC
      const nextOrder = sortOrder === "asc" ? "desc" : "asc";
      params.set("sortOrder", nextOrder);
    } else {
      // New column: set as sortBy and default to asc
      params.set("sortBy", columnKey);
      params.set("sortOrder", "asc");
    }
    
    params.set("page", "1"); // Reset to page 1 to ensure visibility
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return {
    sortBy,
    sortOrder,
    setSorting,
  };
}
export default useSorting;
