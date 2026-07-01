import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function useSorting(defaultSortBy = "unit_number", defaultSortOrder: "asc" | "desc" = "asc") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortBy = searchParams.get("sortBy") || defaultSortBy;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || defaultSortOrder;

  const setSorting = (columnKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (sortBy === columnKey) {
      const nextOrder = sortOrder === "asc" ? "desc" : "asc";
      params.set("sortOrder", nextOrder);
    } else {
      params.set("sortBy", columnKey);
      params.set("sortOrder", "asc");
    }
    
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return {
    sortBy,
    sortOrder,
    setSorting,
  };
}
export default useSorting;
