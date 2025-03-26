export interface PluginOptions {
  force?: boolean;
}

export interface PluginInstaller {
  /**
   * Install the plugin and its dependencies
   */
  install(options: PluginOptions): Promise<void>;

  /**
   * Validate the installation environment
   */
  validateEnvironment(): Promise<boolean>;

  /**
   * Update Payload config to include the plugin
   */
  updatePayloadConfigFile(): Promise<void>;

  /**
   * Get the plugin's package name
   */
  getPackageName(): string;
}
