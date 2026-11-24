import {
  getDirectoryCategories,
  getListings,
  getProducts,
  getShopCategories,
} from "../data/repository";

const routeLoaders = {
  "/": () => import("../pages/HomePage"),
  "/listings": () => import("../pages/DirectoryPage"),
  "/shop": () => import("../pages/ShopPage"),
  "/community": () => import("../pages/CommunityPage"),
  "/blog": () => import("../pages/BlogPage"),
  "/uniforms": () => import("../pages/UniformStudioPage"),
};

const routePromises = new Map();

function normalizedRoute(href) {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return href.split("?")[0];
  }
}

function prefetchRouteChunk(href) {
  const route = normalizedRoute(href);
  const loader = routeLoaders[route];
  if (!loader || routePromises.has(route)) return routePromises.get(route);
  const pending = loader().catch(() => routePromises.delete(route));
  routePromises.set(route, pending);
  return pending;
}

export function prefetchNavigationChunks(routes) {
  routes.forEach(prefetchRouteChunk);
}

export function prefetchNavigation(href) {
  const route = normalizedRoute(href);
  prefetchRouteChunk(route);

  if (route === "/listings") {
    Promise.all([getListings(), getDirectoryCategories()]).catch(() => {});
  }
  if (route === "/shop") {
    Promise.all([getProducts(), getShopCategories()]).catch(() => {});
  }
}
