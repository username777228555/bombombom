export interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

export interface RelocateInfo {
  fraction: number;
  label: string;
  location?: string;
}

export interface SelectionInfo {
  text: string;
  cfi?: string;
  page?: number;
}

export interface SearchGroup {
  label?: string;
  items: { target: string; excerpt: string }[];
}

/** Functions both viewers (foliate / pdf.js) expose to the reader chrome. */
export interface ReaderApi {
  next(): void;
  prev(): void;
  goToFraction(f: number): void;
  goTo(target: string): void;
  applySettings(): void;
  search(q: string): AsyncGenerator<SearchGroup>;
  clearSearch(): void;
  clearSelection(): void;
  addHighlight?(a: { cfi?: string; color?: string }): void;
  removeHighlight?(a: { cfi?: string }): void;
  zoom?(factor: number): void;
}
