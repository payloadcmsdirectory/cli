import chalk from "chalk";
import inquirer from "inquirer";

import { createSection, displayBanner, listItem } from "../utils/ui";

interface CommandHelp {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  options?: { flag: string; description: string }[];
}

const commands: CommandHelp[] = [
  {
    name: "init",
    description: "Initialize a PayloadCMS project with plugins",
    usage: "payloadcli init",
    examples: ["payloadcli init"],
  },
  {
    name: "add",
    description: "Add a plugin to your PayloadCMS project",
    usage: "payloadcli add [plugin]",
    examples: [
      "payloadcli add",
      "payloadcli add shadcn-ui",
      "payloadcli add shadcn-ui --local",
    ],
    options: [
      { flag: "-y, --yes", description: "Skip confirmation prompts" },
      { flag: "-d, --dry-run", description: "Simulate installation" },
      {
        flag: "-l, --local",
        description: "Skip package installation for local testing",
      },
    ],
  },
  {
    name: "list",
    description: "List all available plugins",
    usage: "payloadcli list",
    examples: ["payloadcli list"],
  },
  {
    name: "update",
    description: "Update an installed plugin",
    usage: "payloadcli update [plugin]",
    examples: ["payloadcli update", "payloadcli update shadcn-ui"],
  },
  {
    name: "remove",
    description: "Remove an installed plugin",
    usage: "payloadcli remove [plugin]",
    examples: ["payloadcli remove", "payloadcli remove shadcn-ui"],
  },
  {
    name: "generate:collection",
    description: "Generate a new PayloadCMS collection",
    usage: "payloadcli generate:collection [name]",
    examples: [
      "payloadcli generate:collection",
      "payloadcli generate:collection Posts",
      "payloadcli gc Posts --yes",
    ],
    options: [
      { flag: "-y, --yes", description: "Skip confirmation prompts" },
      { flag: "-d, --dry-run", description: "Simulate generation" },
    ],
  },
  {
    name: "init:config",
    description: "Initialize a PayloadCLI configuration file",
    usage: "payloadcli init:config",
    examples: ["payloadcli init:config", "payloadcli config --force"],
    options: [
      { flag: "-y, --yes", description: "Skip confirmation prompts" },
      { flag: "-f, --force", description: "Overwrite existing config" },
    ],
  },
];

function renderHeader() {
  console.clear();
  displayBanner();
  createSection(
    "Help & Documentation",
    "Learn how to use PayloadCMS Directory CLI",
  );
  console.log(); // Add some spacing
}

function displayCommandHelp(command: CommandHelp) {
  renderHeader();

  console.log(chalk.bold.blue(`${command.name}`));
  console.log(chalk.white(command.description));

  console.log(chalk.bold("\nUsage:"));
  console.log(chalk.cyan(`  ${command.usage}`));

  if (command.options && command.options.length > 0) {
    console.log(chalk.bold("\nOptions:"));
    command.options.forEach((opt) => {
      console.log(chalk.cyan(`  ${opt.flag}`));
      console.log(`    ${opt.description}`);
    });
  }

  console.log(chalk.bold("\nExamples:"));
  command.examples.forEach((example) => {
    console.log(chalk.cyan(`  ${example}`));
  });
}

function displayOverview() {
  renderHeader();

  console.log(chalk.bold.blue("PayloadCMS Directory CLI"));
  console.log(
    chalk.white(
      "\nA command-line tool for managing PayloadCMS plugins and project configuration.",
    ),
  );
  console.log(chalk.bold("\nKey Features:"));
  listItem("Install and manage PayloadCMS plugins", "📦");
  listItem("Generate collections and configurations", "🔨");
  listItem("Interactive menus for easy navigation", "🎯");
  listItem("Project initialization and setup", "🚀");
}

function displayDocs() {
  renderHeader();

  console.log(chalk.bold.blue("Online Documentation"));
  console.log(
    `\nVisit ${chalk.underline(
      "https://github.com/payloadcmsdirectory/cli#readme",
    )} for full documentation.`,
  );
  console.log(
    `\nReport issues at ${chalk.underline(
      "https://github.com/payloadcmsdirectory/cli/issues",
    )}`,
  );
}

function displayTroubleshooting() {
  renderHeader();

  console.log(chalk.bold.blue("Troubleshooting"));
  console.log(chalk.bold("\nCommon Issues:"));
  listItem(
    "Plugin not found - Make sure you're using the correct plugin name",
    "🔍",
  );
  listItem(
    "Installation fails - Check your project's package.json and dependencies",
    "📦",
  );
  listItem("Config file errors - Verify your payload.config.ts format", "⚙️");
  console.log(chalk.bold("\nNeed more help? Join our community:"));
  console.log(
    `Visit ${chalk.underline(
      "https://github.com/payloadcmsdirectory/cli/discussions",
    )}`,
  );
}

export async function helpCommand() {
  let keepNavigating = true;

  while (keepNavigating) {
    renderHeader();

    const { topic } = await inquirer.prompt([
      {
        type: "list",
        name: "topic",
        message: "What would you like to learn about?",
        pageSize: 10,
        choices: [
          { name: "📚 Overview", value: "overview" },
          new inquirer.Separator("─── Commands ───"),
          ...commands.map((cmd) => ({
            name: `${cmd.name} - ${cmd.description}`,
            value: cmd.name,
          })),
          new inquirer.Separator(),
          { name: "🔗 Online Documentation", value: "docs" },
          { name: "❓ Troubleshooting", value: "troubleshooting" },
          { name: "↩️  Back to Main Menu", value: "back" },
        ],
      },
    ]);

    if (topic === "back") {
      console.clear();
      return;
    }

    switch (topic) {
      case "overview":
        displayOverview();
        break;
      case "docs":
        displayDocs();
        break;
      case "troubleshooting":
        displayTroubleshooting();
        break;
      default:
        const command = commands.find((cmd) => cmd.name === topic);
        if (command) {
          displayCommandHelp(command);
        }
    }

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "📚 Back to Help Menu", value: "back" },
          { name: "🏠 Back to Main Menu", value: "main" },
        ],
      },
    ]);

    if (action === "main") {
      console.clear();
      return;
    }
  }
}
