/**
 * PayloadCLI configuration template for .cjs file
 */
export const CONFIG_TEMPLATE = `/**
 * PayloadCLI Configuration File (.cjs - CommonJS format)
 * 
 * This file contains configuration options for the PayloadCLI tool.
 * The .cjs extension ensures CommonJS module format is used, which is required
 * even in projects with "type": "module" in package.json.
 */
module.exports = {
  /**
   * Collections configuration
   */
  collections: {
    /**
     * Path to the collections directory
     * Default: "src/collections"
     */
    path: "src/collections",
  },
  
  /**
   * Globals configuration
   */
  globals: {
    /**
     * Path to the globals directory
     * Default: "src/globals"
     */
    path: "src/globals",
  },

  /**
   * Plugin configuration
   */
  plugins: {
    /**
     * Directory where plugin files are stored
     * Default: "src/plugins"
     */
    path: "src/plugins",
  },
  
  /**
   * Templates configuration
   */
  templates: {
    /**
     * Directory where collection templates are stored locally
     * Default: ".payload/templates"
     */
    path: ".payload/templates",
    
    /**
     * Whether to use local templates (when available) instead of built-in ones
     * Default: false
     */
    useLocal: false,
  }
};
`;
