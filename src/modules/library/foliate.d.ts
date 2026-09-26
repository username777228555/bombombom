declare module '$lib/vendor/foliate-js/view.js' {
  export const makeBook: (file: File) => Promise<FoliateBook>;
}
declare module '$lib/vendor/foliate-js/overlayer.js' {
  export const Overlayer: { highlight: unknown; underline: unknown; outline: unknown };
}

interface FoliateTocItem {
  label: string;
  href: string;
  subitems?: FoliateTocItem[];
}
interface FoliateBook {
  metadata?: { title?: string | Record<string, string>; author?: unknown; language?: string };
  toc?: FoliateTocItem[];
  dir?: string;
  getCover?: () => Promise<Blob | null> | Blob | null;
}
