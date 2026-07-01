import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function useFilter(defaultStatus = "all") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") || defaultStatus;

  const setFilter = (newStatus: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newStatus === "all" || !newStatus) {
      params.delete("status");
    } else {
      params.set("status", newStatus);
    }
    
    params.set("page", "1"); // Reset to page 1 when filter changes
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return {
    status,
    setFilter,
  };
}
export default useFilter;
