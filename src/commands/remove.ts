import { execSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";

import { logger } from "../utils/logger";
import { detectPackageManager } from "../utils/packageManager";
import { availablePlugins, getPluginByName } from "../utils/plugins";

export async function removeCommand(pluginName: string | undefined) {
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

      // Let user choose which plugin to remove
      const { selectedPlugin } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedPlugin",
          message: "Select a plugin to remove:",
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

  // Confirm removal
  const { confirmRemove } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmRemove",
      message: `Are you sure you want to remove ${pluginName}?`,
      default: false,
    },
  ]);

  if (!confirmRemove) {
    logger.info("Removal cancelled");
    return;
  }

  // Find the plugin info
  const plugin = getPluginByName(pluginName || "");

  // Remove the plugin
  const packageManager = detectPackageManager();
  const spinner = ora(`Removing ${pluginName}...`).start();

  try {
    // Remove the package
    let removeCmd = "";
    switch (packageManager) {
      case "npm":
        removeCmd = "npm uninstall";
        break;
      case "yarn":
        removeCmd = "yarn remove";
        break;
      case "pnpm":
        removeCmd = "pnpm remove";
        break;
    }

    execSync(`${removeCmd} ${pluginName}`, { stdio: "ignore" });

    // Update the config file if it exists
    const configPath = path.join(
      process.cwd(),
      "payloadcmsdirectory.config.js",
    );
    if (fs.existsSync(configPath) && pluginName) {
      let configContent = await fs.readFile(configPath, "utf8");

      // Remove the plugin from the plugins array
      configContent = configContent
        .replace(new RegExp(`['"]${pluginName}['"][,]?\\s*`, "g"), "")
        .replace(/,\s*]/, "]"); // Clean up trailing commas

      await fs.writeFile(configPath, configContent);
    }

    spinner.succeed(`Removed ${pluginName}`);

    if (plugin) {
      logger.success(`Successfully removed ${plugin.name} from your project`);

      // Any additional cleanup instructions
      if (plugin.category === "ui") {
        logger.info(
          "Note: You may need to remove any imports or components from your code.",
        );
      }
    } else {
      logger.success(`Successfully removed ${pluginName} from your project`);
    }
  } catch (error) {
    spinner.fail(`Failed to remove ${pluginName}`);
    if (error instanceof Error) {
      logger.error(error.message);
    }
  }
}
