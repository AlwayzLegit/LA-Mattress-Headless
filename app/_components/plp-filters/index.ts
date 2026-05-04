// Shared faceted-filter UI for product list surfaces (collection PLP, search).
// Layered components share open state via FilterShell context, so the
// mobile trigger button (placed in the toolbar) can open the panel
// (placed in the sidebar grid slot).

export { FilterShell, useFilterShell } from './filter-shell';
export { FilterPanel } from './filter-panel';
export { FilterMobileTrigger } from './filter-mobile-trigger';
export { ActiveFilters } from './active-filters';
export {
  FILTER_PARAMS,
  parseFilterSelection,
  selectionToProductFilters,
  withFilterChange,
  clearAllFilters,
  hasAnyFilter,
  paramForFilterId,
  type FilterParam,
  type FilterSelection,
} from './filters';
