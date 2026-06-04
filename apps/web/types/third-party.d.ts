// Plotly's minified distribution ships no .d.ts. We use it only as the
// rendering backend for react-plotly.js's createPlotlyComponent factory,
// where the typing comes from @types/react-plotly.js, so a permissive
// `any` here is fine.
declare module 'plotly.js-basic-dist-min';

// react-plotly.js/factory exports a function with the same shape as the
// default export; same reasoning.
declare module 'react-plotly.js/factory';
