/**
 * declarations.d.ts
 * global type declarations for assets that TypeScript cannot resolve natively.
 */

// css modules — all *.module.css files are treated as objects mapping class names to strings
declare module '*.module.css' {
  const styles: Record<string, string>;
  export default styles;
}

// plain css imports (used for global stylesheets)
declare module '*.css' {
  const styles: Record<string, string>;
  export default styles;
}

// svg imports
declare module '*.svg' {
  const src: string;
  export default src;
}

// image imports
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
