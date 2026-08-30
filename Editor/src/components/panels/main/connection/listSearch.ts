export function filterControllerList<T>(
  items: T[],
  searchText: string,
  getSearchValues: (item: T) => Array<string | null | undefined>,
): T[] {
  const keyword = searchText.trim().toLocaleLowerCase();
  if (!keyword) return items;

  return items.filter((item) =>
    getSearchValues(item).some((value) =>
      value?.toLocaleLowerCase().includes(keyword),
    ),
  );
}
