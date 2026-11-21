import "@testing-library/jest-dom/vitest";
import React from "react";

// Vitest's current transform path still emits the classic JSX runtime for
// test files. Keep React available there without reintroducing Vite's obsolete
// global esbuild JSX override into the production build.
globalThis.React = React;
