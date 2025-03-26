import path from "path";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";

import { CONFIG_TEMPLATE } from "../utils/configTemplate";
import { logger } from "../utils/logger";
import { createSection, listItem } from "../utils/ui";

interface InitConfigOptions {
  yes?: boolean;
  force?: boolean;
}

/**
 * Check if a config file is using ESM syntax and convert to CommonJS if needed
 */
async function checkAndFixESMConfig(configPath: string): Promise<boolean> {
  try {
    if (await fs.pathExists(configPath)) {
      const content = await fs.readFile(configPath, "utf8");

      // Check for ESM syntax indicators
      const isESM =
        content.includes("export default") || content.includes("export const");

      if (isESM) {
        logger.info(chalk.yellow("Detected ESM syntax in config file."));
        const { convert } = await inquirer.prompt([
          {
            type: "confirm",
            name: "convert",
            message: "Would you like to convert it to CommonJS format?",
            default: true,
          },
        ]);

        if (convert) {
          // Create backup
          await fs.writeFile(`${configPath}.bak`, content, "utf8");

          // Convert to CommonJS
          let commonJSContent = content
            .replace(/export\s+default\s+/, "module.exports = ")
            .replace(/export\s+const\s+(\w+)\s+=\s+/, "const $1 = ")
            .replace(
              /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
              'const {$1} = require("$2")',
            );

          await fs.writeFile(configPath, commonJSContent, "utf8");
          logger.info(
            chalk.green("Successfully converted config to CommonJS format."),
          );
          logger.info(
            chalk.gray(
              "A backup of your original file was created at " +
                `${configPath}.bak`,
            ),
          );
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    logger.debug(`Error checking/fixing config: ${error}`);
    return false;
  }
}

/**
 * Command to initialize the PayloadCLI configuration file
 */
export async function initConfigCommand(options: InitConfigOptions = {}) {
  createSection(
    "Initialize Configuration",
    "Create a PayloadCLI configuration file",
  );

  const configPath = path.resolve("payloadcli.config.cjs");
  const exists = await fs.pathExists(configPath);

  // Try to fix ESM config if it exists
  if (exists) {
    const fixed = await checkAndFixESMConfig(configPath);
    if (fixed && !options.force) {
      logger.info(
        "Config file was converted to CommonJS format. No need to recreate.",
      );
      return;
    }
  }

  // Check if config already exists
  if (exists && !options.force && !options.yes) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Configuration file already exists. Overwrite?",
        default: false,
      },
    ]);

    if (!overwrite) {
      logger.info("Configuration initialization cancelled");
      return;
    }
  }

  // Determine collection and globals paths
  let collectionsPath = "src/collections";
  let globalsPath = "src/globals";

  // Try to detect existing paths
  if (await fs.pathExists("src/payload.config.ts")) {
    try {
      const payloadConfig = await fs.readFile("src/payload.config.ts", "utf8");

      // Simple regex to find collections and globals paths
      const collectionsMatch = payloadConfig.match(
        /collections:\s*\[([^\]]*)\]/s,
      );
      const globalsMatch = payloadConfig.match(/globals:\s*\[([^\]]*)\]/s);

      if (collectionsMatch || globalsMatch) {
        logger.info("Detected existing PayloadCMS configuration");
      }
    } catch (error) {
      // If we can't read the file, just use defaults
      logger.debug(`Error reading PayloadCMS config: ${error}`);
    }
  }

  // Prompt for paths if not using yes flag
  if (!options.yes) {
    const { collections, globals } = await inquirer.prompt([
      {
        type: "input",
        name: "collections",
        message: "Path to collections directory:",
        default: collectionsPath,
      },
      {
        type: "input",
        name: "globals",
        message: "Path to globals directory:",
        default: globalsPath,
      },
    ]);

    collectionsPath = collections;
    globalsPath = globals;
  }

  // Generate config content with user paths
  const configContent = CONFIG_TEMPLATE.replace(
    /"src\/collections"/g,
    `"${collectionsPath}"`,
  ).replace(/"src\/globals"/g, `"${globalsPath}"`);

  const spinner = ora("Creating configuration file...").start();

  try {
    await fs.writeFile(configPath, configContent, "utf8");
    spinner.succeed("Configuration file created successfully");

    console.log();
    logger.info("Configuration file created at:");
    listItem(chalk.cyan(configPath));

    console.log();
    logger.info("This file contains settings for:");
    listItem("Collections directory location");
    listItem("Globals directory location");
    listItem("Plugin directory location");

    console.log();
    logger.info("You can edit this file to customize paths and other settings");
    logger.info(
      chalk.yellow(
        "Note: This is a CommonJS file that uses module.exports syntax",
      ),
    );
  } catch (error: unknown) {
    spinner.fail("Failed to create configuration file");
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error("An unknown error occurred");
    }
  }
}
