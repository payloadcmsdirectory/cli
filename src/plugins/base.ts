import fs from "fs-extra";
import ora from "ora";

import { logger } from "../utils/logger";
import { backupFile, findConfigFile } from "../utils/plugins";
import { PluginInstaller, PluginOptions } from "./types";

export abstract class BasePluginInstaller implements PluginInstaller {
  protected spinner: ora.Ora;

  constructor() {
    this.spinner = ora();
  }

  abstract install(options: PluginOptions): Promise<void>;
  abstract getPackageName(): string;

  /**
   * Default validation - can be overridden by specific plugins
   */
  async validateEnvironment(): Promise<boolean> {
    return true;
  }

  /**
   * Base implementation for updating Payload config
   * Can be overridden by specific plugins if needed
   */
  protected async updatePayloadConfig(configContent: string): Promise<string> {
    const packageName = this.getPackageName();
    const pluginName = this.getPluginImportName();

    // First, check for existing imports
    const importRegex = new RegExp(
      `import\\s+.*?${pluginName}.*?from\\s+['"]${packageName}['"]`,
      "g",
    );
    if (!importRegex.test(configContent)) {
      // Add import statement at the top of the file
      configContent = `import { ${pluginName} } from '${packageName}';\n${configContent}`;
    }

    // Find the plugins array in the config
    const pluginsMatch = configContent.match(/plugins\s*:\s*\[([\s\S]*?)\]/);

    if (pluginsMatch) {
      const currentPlugins = pluginsMatch[1];
      const pluginConfig = this.getPluginConfig();

      // More robust check for existing plugin configuration
      // This handles both the imported name and any local variable name
      const pluginRegex = new RegExp(
        `(${pluginName}|shadcnPlugin)\\s*\\(\\s*\\{[\\s\\S]*?\\}\\s*\\)`,
        "g",
      );
      const hasPlugin = pluginRegex.test(currentPlugins);

      if (!hasPlugin) {
        // Clean up any trailing commas and extra whitespace
        const cleanedPlugins = currentPlugins
          .replace(/,\s*,/g, ",") // Remove double commas
          .replace(/,\s*$/, "") // Remove trailing comma
          .trim();

        const separator = cleanedPlugins ? "," : "";
        const newPluginsSection = `plugins: [${cleanedPlugins}${separator}${pluginConfig}]`;

        // Replace the entire plugins section
        configContent = configContent.replace(
          /plugins\s*:\s*\[[\s\S]*?\]/,
          newPluginsSection,
        );
      }
    } else {
      // If no plugins array found, add it before the closing brace of buildConfig
      const buildConfigMatch = configContent.match(
        /buildConfig\s*\(\s*\{([\s\S]*?)\}\s*\)/,
      );
      if (buildConfigMatch) {
        const configBody = buildConfigMatch[1];
        const newConfigBody =
          configBody + `\n  plugins: [${this.getPluginConfig()}],`;
        configContent = configContent.replace(configBody, newConfigBody);
      }
    }

    // Clean up any formatting issues
    configContent = configContent
      .replace(/,\s*,/g, ",") // Remove double commas
      .replace(/\[\s*,/, "[") // Remove comma after opening bracket
      .replace(/,\s*\]/, "]"); // Remove comma before closing bracket

    return configContent;
  }

  /**
   * Get the plugin's import name (can be overridden)
   */
  protected getPluginImportName(): string {
    return this.getPackageName().split("/").pop()?.replace(/-/g, "") || "";
  }

  /**
   * Get the plugin's config object (should be overridden)
   */
  protected abstract getPluginConfig(): string;

  /**
   * Helper to update the Payload config file
   */
  public async updatePayloadConfigFile(): Promise<void> {
    const configPath = await findConfigFile([
      "src/payload.config.ts",
      "payload.config.ts",
      "src/payload.config.js",
      "payload.config.js",
    ]);

    if (!configPath) {
      throw new Error("Could not find payload config file");
    }

    try {
      // Backup the original config
      await backupFile(configPath);

      // Read the current config
      let configContent = await fs.readFile(configPath, "utf-8");

      // Update the config
      configContent = await this.updatePayloadConfig(configContent);

      // Write the updated config
      await fs.writeFile(configPath, configContent);

      logger.info(`Updated ${configPath}`);
      logger.info(`Backup created at ${configPath}.bak`);
    } catch (error) {
      // Attempt to restore backup if it exists
      if (await fs.pathExists(`${configPath}.bak`)) {
        await fs.copy(`${configPath}.bak`, configPath);
        logger.info("Restored config from backup");
      }
      throw error;
    }
  }
}
