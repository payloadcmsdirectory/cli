import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";

import { addCommand } from "./commands/add";
import { generateCollectionCommand } from "./commands/generateCollection";
import { helpCommand } from "./commands/help";
import { initCommand } from "./commands/init";
import { initConfigCommand } from "./commands/initConfig";
import { listCommand } from "./commands/list";
import { removeCommand } from "./commands/remove";
import { updateCommand } from "./commands/update";
import { createSection, displayBanner, listItem } from "./utils/ui";

const program = new Command();

// Disable built-in help command and option
program.helpOption(false);
program.addHelpCommand(false);

program
  .name("payloadcli")
  .description("PayloadCMS Directory CLI")
  .version("0.2.2");

// Register help command and option that use our interactive help
program.option("-h, --help", "Show help menu").action((options) => {
  if (options.help) {
    helpCommand();
    return;
  }
});

// Register commands
program
  .command("init")
  .description("Initialize a PayloadCMS project")
  .action(initCommand);

program
  .command("add [plugin]")
  .description("Add a plugin to your project")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("-d, --dry-run", "Simulate installation")
  .option("-l, --local", "Skip package installation for local testing")
  .action(addCommand);

program
  .command("list")
  .description("List available plugins")
  .action(listCommand);

program
  .command("update [plugin]")
  .description("Update an installed plugin")
  .action(updateCommand);

program
  .command("remove [plugin]")
  .description("Remove an installed plugin")
  .action(removeCommand);

program
  .command("generate:collection [name]")
  .alias("gc")
  .description("Generate a new collection")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("-d, --dry-run", "Simulate generation")
  .action(generateCollectionCommand);

program
  .command("init:config")
  .description("Initialize PayloadCLI config file")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("-f, --force", "Overwrite existing config")
  .action(initConfigCommand);

// Add interactive help command
program
  .command("help")
  .description("Show interactive help menu")
  .action(helpCommand);

function renderMainMenu() {
  console.clear();
  displayBanner();
  createSection(
    "PayloadCMS Directory CLI",
    "Manage your PayloadCMS plugins and configuration",
  );
  console.log(); // Add some spacing
}

// Show interactive menu if no arguments provided
if (process.argv.length === 2) {
  showInteractiveMenu();
}

async function showInteractiveMenu() {
  let keepNavigating = true;

  while (keepNavigating) {
    renderMainMenu();

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        pageSize: 10,
        choices: [
          { name: "🚀 Initialize a project", value: "init" },
          { name: "📦 Add a plugin", value: "add" },
          { name: "📋 List plugins", value: "list" },
          { name: "🔄 Update a plugin", value: "update" },
          { name: "🗑️  Remove a plugin", value: "remove" },
          { name: "🔨 Generate collection", value: "generate:collection" },
          { name: "⚙️  Initialize config file", value: "init:config" },
          { name: "❓ Help & Documentation", value: "help" },
          { name: "👋 Exit", value: "exit" },
        ],
      },
    ]);

    if (action === "exit") {
      console.clear();
      process.exit(0);
    }

    if (action === "help") {
      await helpCommand();
      continue;
    }

    try {
      // Execute the selected command
      await program.parseAsync([process.argv[0], process.argv[1], action]);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      console.error(chalk.red("\nError:"), errorMessage);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Show error for 2 seconds
    }

    // After command completes, prompt to continue
    const { continue: shouldContinue } = await inquirer.prompt([
      {
        type: "list",
        name: "continue",
        message: "What would you like to do next?",
        choices: [
          { name: "🏠 Return to Main Menu", value: "menu" },
          { name: "👋 Exit", value: "exit" },
        ],
      },
    ]);

    if (shouldContinue === "exit") {
      console.clear();
      process.exit(0);
    }
  }
}

// Parse command line arguments
program.parse();
