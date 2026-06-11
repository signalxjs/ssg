/**
 * Layouts module exports
 */

export { scanLocalLayouts, loadThemeLayouts, discoverLayouts, getDefaultLayout, findLayout } from './resolver';
export type { LayoutInfo } from './resolver';

export { generateLayoutsModule, loadLayoutsModule, VIRTUAL_LAYOUTS_ID, RESOLVED_VIRTUAL_LAYOUTS_ID } from './virtual';
