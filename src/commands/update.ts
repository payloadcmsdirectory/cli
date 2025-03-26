import { execSync } from "child_process";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";

import { logger } from "../utils/logger";
import { detectPackageManager } from "../utils/packageManager";
import { availablePlugins, getPluginByName } from "../utils/plugins";

export async function updateCommand(pluginName: string | undefined) {
  // If no plugin specified, try to get installed plugins
  if (!pluginName) {
    try {
      const packageJson = await fs.readJSON("package.json");
      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};

      // Find installed plugins
      const installedPlugins = availablePlugins.filter(
        (plugin) =>
          dependencies[plugin.packageName] ||
          devDependencies[plugin.packageName],
      );

      if (installedPlugins.length === 0) {
        logger.warn("No PayloadCMS plugins found in your project");
        return;
      }

      // Let user choose which plugin to update
      const { selectedPlugin } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedPlugin",
          message: "Select a plugin to update:",
          choices: installedPlugins.map((plugin) => ({
            name: `${plugin.name} (${plugin.packageName})`,
            value: plugin.packageName,
          })),
        },
      ]);

      pluginName = selectedPlugin;
    } catch (error) {
      logger.error("Failed to read package.json");
      return;
    }
  }

  // Find the plugin info
  const plugin = pluginName ? getPluginByName(pluginName) : undefined;

  if (!plugin) {
    logger.error(`Plugin ${pluginName} not found in the PayloadCMS registry`);
    return;
  }

  // Update the plugin
  const packageManager = detectPackageManager();
  const spinner = ora(`Updating ${plugin.packageName}...`).start();

  try {
    execSync(`${packageManager} update ${plugin.packageName}`, {
      stdio: "ignore",
    });
    spinner.succeed(`Updated ${plugin.packageName}`);

    // Get the new version
    try {
      const packageJson = await fs.readJSON(
        "node_modules/" + plugin.packageName + "/package.json",
      );
      logger.success(
        `${plugin.name} updated to version ${packageJson.version}`,
      );
    } catch (e) {
      logger.success(`${plugin.name} updated successfully`);
    }
  } catch (error) {
    spinner.fail(`Failed to update ${plugin.packageName}`);
    if (error instanceof Error) {
      logger.error(error.message);
    }
  }
}
