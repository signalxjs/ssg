/**
 * Routing module exports
 */

export { scanPages, fileToRoute, filePathToRoutePath, pathToRouteName, sortRoutes, isDynamicRoute, extractParams, expandDynamicRoute } from './scanner';

export { resolveRoutes, getAllPaths, matchRoute } from './resolver';
export type { ResolvedRoutes, ExpandedRoute } from './resolver';

export { generateRoutesModule, generateLazyRoutesModule, loadRoutesModule, VIRTUAL_ROUTES_ID, RESOLVED_VIRTUAL_ROUTES_ID } from './virtual';

// Navigation exports
export { generateNavigation, generateAllCollections, detectCollection, mergeNavigation } from './navigation';
export type { CollectionNavigation } from './navigation';
export { generateNavigationModule, loadNavigationModule, VIRTUAL_NAVIGATION_ID, RESOLVED_VIRTUAL_NAVIGATION_ID } from './virtual-navigation';
export type { NavigationModule } from './virtual-navigation';
