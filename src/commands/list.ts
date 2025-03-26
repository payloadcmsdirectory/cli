import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";

import { logger } from "../utils/logger";
import {
  availablePlugins,
  getPluginsByCategory,
  PluginInfo,
} from "../utils/plugins";
import { createSection, listItem } from "../utils/ui";

export async function listCommand() {
  createSection("Available Plugins", "Browse all PayloadCMS Directory plugins");

  const categories = Array.from(
    new Set(availablePlugins.map((plugin) => plugin.category)),
  );

  if (availablePlugins.length === 0) {
    logger.warn("No plugins available");
    return;
  }

  // Load plugin information with spinner
  const spinner = ora("Loading plugin information...").start();

  // Display summary of available plugins
  spinner.succeed(
    `${availablePlugins.length} plugins available in ${categories.length} categories`,
  );

  console.log(
    "\n" +
      chalk.italic.gray(
        "Choose a category to see its plugins, or view details of a specific plugin.\n",
      ),
  );

  // Ask user to choose category or view all
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: chalk.green("View all plugins"), value: "all" },
        { name: chalk.blue("Browse by category"), value: "category" },
        { name: chalk.yellow("Search plugins"), value: "search" },
      ],
    },
  ]);

  if (action === "all") {
    await showAllPlugins();
  } else if (action === "category") {
    await showPluginsByCategory(categories);
  } else if (action === "search") {
    await searchPlugins();
  }
}

async function showAllPlugins() {
  console.log(chalk.bold.blue("\nAll Available Plugins:"));

  for (const plugin of availablePlugins) {
    console.log(
      chalk.bold(`\n${plugin.name} ${chalk.blue(`(${plugin.packageName})`)}`),
    );
    console.log(chalk.white(`  ${plugin.description}`));

    if (plugin.repository) {
      console.log(chalk.gray(`  Repository: ${chalk.cyan(plugin.repository)}`));
    }
  }

  promptForPluginDetails();
}

async function showPluginsByCategory(categories: string[]) {
  const { selectedCategory } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedCategory",
      message: "Select a category:",
      choices: categories.map((category) => ({
        name: chalk.blue(
          `📂 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        ),
        value: category,
      })),
    },
  ]);

  const plugins = getPluginsByCategory(selectedCategory);

  console.log(
    chalk.bold.blue(
      `\n${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Plugins:`,
    ),
  );

  for (const plugin of plugins) {
    console.log(
      chalk.bold(`\n${plugin.name} ${chalk.blue(`(${plugin.packageName})`)}`),
    );
    console.log(chalk.white(`  ${plugin.description}`));

    if (plugin.repository) {
      console.log(chalk.gray(`  Repository: ${chalk.cyan(plugin.repository)}`));
    }
  }

  promptForPluginDetails();
}

async function searchPlugins() {
  const { searchTerm } = await inquirer.prompt([
    {
      type: "input",
      name: "searchTerm",
      message: "Enter search term:",
      validate: (input) =>
        input.length > 0 ? true : "Please enter a search term",
    },
  ]);

  const results = availablePlugins.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.packageName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (results.length === 0) {
    console.log(chalk.yellow(`\nNo plugins found matching "${searchTerm}"`));
    return;
  }

  console.log(
    chalk.bold.green(
      `\nFound ${results.length} plugins matching "${searchTerm}":`,
    ),
  );

  for (const plugin of results) {
    console.log(
      chalk.bold(`\n${plugin.name} ${chalk.blue(`(${plugin.packageName})`)}`),
    );
    console.log(chalk.white(`  ${plugin.description}`));

    if (plugin.repository) {
      console.log(chalk.gray(`  Repository: ${chalk.cyan(plugin.repository)}`));
    }
  }

  promptForPluginDetails();
}

async function promptForPluginDetails() {
  // Ask if user wants to see details of a specific plugin
  const { viewDetails } = await inquirer.prompt([
    {
      type: "confirm",
      name: "viewDetails",
      message: "Would you like to view details of a specific plugin?",
      default: false,
    },
  ]);

  if (viewDetails) {
    const { selectedPlugin } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedPlugin",
        message: "Select a plugin:",
        choices: availablePlugins.map((plugin) => ({
          name: `${plugin.name} - ${plugin.description}`,
          value: plugin.packageName,
        })),
      },
    ]);

    await showPluginDetails(selectedPlugin);
  } else {
    logger.info(
      `To add a plugin, run: ${chalk.bold("npx @payloadcmsdirectory/cli add <plugin-name>")}`,
    );
  }
}

async function showPluginDetails(packageName: string) {
  const plugin = availablePlugins.find((p) => p.packageName === packageName);

  if (!plugin) {
    logger.error(`Plugin ${packageName} not found`);
    return;
  }

  createSection("Plugin Details", plugin.name);

  listItem(`Package: ${chalk.cyan(plugin.packageName)}`, "📦");
  listItem(`Category: ${chalk.cyan(plugin.category)}`, "🔖");
  listItem(`Description: ${chalk.white(plugin.description)}`, "📝");

  if (plugin.repository) {
    listItem(`Repository: ${chalk.underline.cyan(plugin.repository)}`, "🔗");
  }

  if (plugin.nextSteps) {
    console.log("\n" + chalk.bold.yellow("Installation Instructions:"));
    console.log(plugin.nextSteps);
  }

  // Prompt for installation
  const { install } = await inquirer.prompt([
    {
      type: "confirm",
      name: "install",
      message: `Would you like to install ${plugin.name}?`,
      default: false,
    },
  ]);

  if (install) {
    // Dynamic import the add command to avoid circular dependencies
    const { addCommand } = require("./add");
    await addCommand(plugin.packageName, {});
  }
}
