import { execSync } from "child_process";
import path from "path";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";

import { logger } from "../utils/logger";
import { detectPackageManager } from "../utils/packageManager";
import {
  availablePlugins,
  getPluginByName,
  PluginInfo,
} from "../utils/plugins";
import { codeBlock, createSection, listItem } from "../utils/ui";

/**
 * Get the current terminal width, defaulting to 80 if not available
 */
const getTerminalWidth = (): number => {
  return process.stdout.columns || 80;
};

/**
 * Word wrap text to fit within terminal width
 * @param text Text to wrap
 * @param indent Indentation for wrapped lines
 * @param maxWidth Maximum width (defaults to terminal width minus 5)
 */
const wrapText = (text: string, indent = "  ", maxWidth?: number): string => {
  const width = maxWidth || Math.max(40, getTerminalWidth() - 5);
  if (text.length <= width) return text;

  const words = text.split(" ");
  let result = "";
  let line = "";

  for (const word of words) {
    if (line.length + word.length + 1 <= width) {
      line += (line ? " " : "") + word;
    } else {
      result += (result ? "\n" + indent : "") + line;
      line = word;
    }
  }

  if (line) {
    result += (result ? "\n" + indent : "") + line;
  }

  return result;
};

/**
 * Display a message with proper word wrapping to fit the terminal
 */
const displayMessage = (message: string, color?: chalk.Chalk): void => {
  const wrappedText = wrapText(message);
  console.log(color ? color(wrappedText) : wrappedText);
};

interface AddCommandOptions {
  yes?: boolean;
  dryRun?: boolean;
  local?: boolean;
}

export async function addCommand(
  pluginName: string | undefined,
  options: AddCommandOptions,
) {
  createSection("Add Plugin", "Install a plugin in your PayloadCMS project");

  // If no plugin specified, show list to choose from with enhanced visuals
  if (!pluginName) {
    // Group plugins by category
    const categories = Array.from(
      new Set(availablePlugins.map((plugin) => plugin.category)),
    );

    const categoryChoices = categories.map((category) => ({
      name: chalk.bold.blue(
        `📂 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
      ),
      value: category,
    }));

    const { selectedCategory } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedCategory",
        message: "Select a plugin category:",
        choices: categoryChoices,
        pageSize: 10,
      },
    ]);

    // Filter plugins by selected category
    const filteredPlugins = availablePlugins.filter(
      (plugin) => plugin.category === selectedCategory,
    );

    const pluginChoices = filteredPlugins.map((plugin) => ({
      name: `${chalk.bold(plugin.name)} - ${chalk.gray(plugin.description)}`,
      value: plugin.packageName,
    }));

    const { selectedPlugin } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedPlugin",
        message: "Select a plugin to add:",
        choices: [
          ...pluginChoices,
          new inquirer.Separator(),
          { name: chalk.blue("← Back to categories"), value: "back" },
        ],
        pageSize: 10,
      },
    ]);

    if (selectedPlugin === "back") {
      // Go back to plugin selection
      return addCommand(undefined, options);
    }

    pluginName = selectedPlugin;
  }

  // Find the plugin info
  const plugin = getPluginByName(pluginName);

  if (!plugin) {
    logger.error(`Plugin ${pluginName} not found`);
    logger.info("Use the list command to see all available plugins.");

    // Show available categories to help the user
    console.log(chalk.bold.blue("\nAvailable plugin categories:"));
    const categories = Array.from(
      new Set(availablePlugins.map((p) => p.category)),
    );

    categories.forEach((category) => {
      console.log(
        chalk.blue(`- ${category.charAt(0).toUpperCase() + category.slice(1)}`),
      );
    });

    console.log(chalk.bold.blue("\nTry again with:"));
    console.log(chalk.blue(`  payloadcli add [plugin]`));
    console.log(chalk.blue(`  payloadcli list`));
    return;
  }

  // Display plugin details before installation
  console.log(chalk.bold.white("\nPlugin Details:"));
  listItem(`Name: ${chalk.cyan(plugin.name)}`, "ℹ️");
  listItem(`Package: ${chalk.cyan(plugin.packageName)}`, "📦");
  listItem(`Description: ${chalk.white(plugin.description)}`, "📝");

  if (plugin.repository) {
    listItem(`Repository: ${chalk.underline.cyan(plugin.repository)}`, "🔗");
  }

  console.log();

  // Check if the plugin is already installed
  try {
    const packageJson = await fs.readJSON("package.json");
    const alreadyInstalled =
      packageJson.dependencies?.[plugin.packageName] ||
      packageJson.devDependencies?.[plugin.packageName];

    if (alreadyInstalled && !options.yes) {
      logger.warn(
        `Plugin ${chalk.cyan(plugin.packageName)} is already installed.`,
      );

      const { reinstall } = await inquirer.prompt([
        {
          type: "confirm",
          name: "reinstall",
          message: "Reinstall this plugin?",
          default: false,
        },
      ]);

      if (!reinstall) {
        logger.info("Installation cancelled");
        return;
      }
    }
  } catch (error) {
    // If we can't read package.json, just continue with installation
    logger.debug("Could not read package.json, continuing with installation");
  }

  await installPlugin(plugin, options);
}

async function installPlugin(plugin: PluginInfo, options: AddCommandOptions) {
  const packageManager = detectPackageManager();
  const spinner = ora({
    text: `Installing ${chalk.cyan(plugin.packageName)}...`,
    spinner: "dots",
    color: "blue",
  }).start();

  try {
    // If dry run mode, simulate without making changes
    if (options.dryRun) {
      spinner.info(
        `[DRY RUN] Would install ${chalk.cyan(plugin.packageName)} using ${packageManager}`,
      );

      // Display config file changes that would be made
      const configPath = path.join(
        process.cwd(),
        "payloadcmsdirectory.config.js",
      );
      if (fs.existsSync(configPath)) {
        spinner.info(
          `[DRY RUN] Would update ${chalk.cyan("payloadcmsdirectory.config.js")} to include the plugin`,
        );
      } else {
        spinner.info(
          `[DRY RUN] Would create ${chalk.cyan("payloadcmsdirectory.config.js")} with the plugin`,
        );
      }

      spinner.succeed(
        `[DRY RUN] Successfully simulated installation of ${chalk.green(plugin.packageName)}`,
      );

      // Show post-install steps
      if (plugin.postInstallFunction) {
        logger.info(
          `[DRY RUN] Would run post-install configuration steps for ${chalk.cyan(plugin.name)}`,
        );
      }

      if (plugin.postInstallSteps) {
        logger.info(
          `[DRY RUN] Would run ${plugin.postInstallSteps.length} post-install steps`,
        );
      }

      logger.success(
        `\n🎉 [DRY RUN] Simulation of adding ${chalk.bold.green(plugin.name)} completed successfully!`,
      );

      // Show example usage
      if (plugin.nextSteps) {
        createSection(
          "Next Steps",
          "Here's what you would need to do after installation",
        );
        console.log(plugin.nextSteps);
        console.log();
      }

      return;
    }

    // For local development testing, skip the actual package installation
    if (options.local) {
      spinner.info(
        `[LOCAL] Skipping package installation for local development`,
      );
      spinner.succeed(
        `[LOCAL] Using local version of ${chalk.green(plugin.packageName)}`,
      );
    } else {
      // Regular installation - install the plugin
      execSync(`${packageManager} add ${plugin.packageName}`, {
        stdio: "ignore",
      });
    }

    // Update the config file if it exists
    const configPath = path.join(
      process.cwd(),
      "payloadcmsdirectory.config.js",
    );
    if (fs.existsSync(configPath)) {
      let configContent = await fs.readFile(configPath, "utf8");

      if (!configContent.includes(plugin.packageName)) {
        // Add the plugin to the plugins array
        configContent = configContent.replace(
          /plugins\s*:\s*\[([\s\S]*?)\]/,
          (match: string, pluginsContent: string) => {
            // If the array is empty
            if (!pluginsContent.trim()) {
              return `plugins: ['${plugin.packageName}']`;
            }
            // If there are existing plugins
            return `plugins: [${pluginsContent}${
              pluginsContent.trim() ? "," : ""
            } '${plugin.packageName}']`;
          },
        );

        await fs.writeFile(configPath, configContent);

        spinner.text = "Updating configuration file...";
      }
    } else {
      spinner.text = "Configuration file not found, creating it...";

      // Create a config file if it doesn't exist
      const configContent = `
/**
 * PayloadCMS Directory Configuration
 */
module.exports = {
  plugins: ['${plugin.packageName}'],
  // Add your customizations here
};
`;
      await fs.writeFile(configPath, configContent);
    }

    spinner.succeed(
      `Successfully installed ${chalk.green(plugin.packageName)}`,
    );

    displayMessage(
      `\n🎉 Successfully added ${chalk.bold.green(plugin.name)} to your project!`,
      chalk.green,
    );

    if (plugin.nextSteps) {
      createSection(
        "Next Steps",
        "Follow these instructions to complete setup",
      );
      displayMessage(plugin.nextSteps);
      console.log();
    }

    // Show example usage
    createSection("Example Usage", "Here's how to use this plugin");
    displayMessage(`First, import the plugin in your PayloadCMS config:`);

    codeBlock(`
// payload.config.ts
import { ${plugin.name.toLowerCase().replace(/\s+/g, "")}Plugin } from "${plugin.packageName}";

export default buildConfig({
  plugins: [
    ${plugin.name.toLowerCase().replace(/\s+/g, "")}Plugin({
      // Plugin options here
    }),
    // ... other plugins
  ],
  // ... rest of your config
});`);

    console.log();

    // Handle post-installation steps - improved with better UI
    console.log();
    console.log(chalk.bold.blue("===== Running Post-Installation Steps ====="));
    console.log();

    // Use a separate function to handle post-installation to better control spinners
    await runPostInstallation(plugin);
  } catch (error) {
    spinner.fail(`Failed to install ${plugin.packageName}`);
    if (error instanceof Error) {
      logger.error(error.message);
    }
    logger.info(
      `Try installing manually with: ${chalk.cyan(`${packageManager} add ${plugin.packageName}`)}`,
    );
  }
}

/**
 * Run post-installation steps for a plugin with proper spinner handling
 */
async function runPostInstallation(plugin: PluginInfo): Promise<void> {
  const postInstallSpinner = ora({
    text: "Preparing post-installation steps...",
    color: "blue",
  }).start();

  try {
    // First check if there are any post-install steps
    if (!plugin.postInstallSteps && !plugin.postInstallFunction) {
      postInstallSpinner.succeed("No post-installation steps required");
      return;
    }

    // Stop the spinner before post-install function to avoid overlap with prompts
    postInstallSpinner.succeed("Ready to run post-installation steps");
    console.log();

    // Handle postInstallFunction first (it often contains prompts)
    if (plugin.postInstallFunction) {
      console.log(chalk.cyan("→ Running configuration steps..."));
      await plugin.postInstallFunction();
      console.log();
    }

    // Then handle any additional steps
    if (plugin.postInstallSteps && plugin.postInstallSteps.length > 0) {
      console.log(
        chalk.cyan(
          `→ Running ${plugin.postInstallSteps.length} additional steps...`,
        ),
      );

      for (const step of plugin.postInstallSteps) {
        if (typeof step === "string") {
          // Display each step message clearly
          console.log(chalk.blue(`  • ${wrapText(step)}`));
        } else if (typeof step === "function") {
          // For function steps, use a spinner
          const stepSpinner = ora({
            text: "Running step...",
            color: "blue",
          }).start();

          await step();

          stepSpinner.succeed("Step completed");
          console.log();
        }
      }
    }

    console.log(); // Final spacing
    console.log(
      chalk.green("✓ Post-installation steps completed successfully"),
    );
    console.log();
  } catch (error) {
    // If spinner is still running, stop it with fail
    if (postInstallSpinner.isSpinning) {
      postInstallSpinner.fail("Failed to complete post-installation steps");
    } else {
      console.log(chalk.red("✖ Failed to complete post-installation steps"));
    }

    console.log();
    logger.error(`Error: ${error}`);
  }
}
