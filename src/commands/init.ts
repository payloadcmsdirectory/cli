import { execSync } from "child_process";
import path from "path";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";

import { logger } from "../utils/logger";
import { detectPackageManager } from "../utils/packageManager";

export async function initCommand() {
  logger.info("Initializing a new PayloadCMS project with plugins");

  // Check if we're in a PayloadCMS project
  const isExistingProject = fs.existsSync("package.json");

  if (!isExistingProject) {
    const { createNew } = await inquirer.prompt([
      {
        type: "confirm",
        name: "createNew",
        message: "No project detected. Create a new PayloadCMS project?",
        default: true,
      },
    ]);

    if (createNew) {
      // Create new PayloadCMS project
      await createNewProject();
    } else {
      logger.error("Cannot initialize without a PayloadCMS project");
      process.exit(1);
    }
  } else {
    // Check if it's a PayloadCMS project
    const packageJson = await fs.readJSON("package.json");
    const hasPayload =
      packageJson.dependencies &&
      (packageJson.dependencies.payload ||
        packageJson.devDependencies?.payload);

    if (!hasPayload) {
      logger.warn("This does not appear to be a PayloadCMS project");
      const { proceed } = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: "Proceed anyway?",
          default: false,
        },
      ]);

      if (!proceed) {
        process.exit(0);
      }
    }
  }

  // Setup plugins config
  await setupConfig();

  // Ask which plugins to install
  await installPlugins();

  logger.success("Project initialized successfully!");
}

async function createNewProject() {
  const { projectName } = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "Enter a name for your project:",
      default: "payload-project",
    },
  ]);

  const spinner = ora("Creating a new PayloadCMS project...").start();

  try {
    execSync(`npx create-payload-app ${projectName}`, { stdio: "ignore" });
    spinner.succeed("Created a new PayloadCMS project");

    // Change to the new directory
    process.chdir(projectName);
  } catch (error) {
    spinner.fail("Failed to create a new PayloadCMS project");
    process.exit(1);
  }
}

async function setupConfig() {
  // Create a payloadcmsdirectory.config.js file
  const configPath = path.join(process.cwd(), "payloadcmsdirectory.config.js");

  if (fs.existsSync(configPath)) {
    logger.warn("Config file already exists, skipping creation");
    return;
  }

  const configContent = `
/**
 * PayloadCMS Configuration
 */
module.exports = {
  plugins: [],
  // Add your customizations here
};
`;

  await fs.writeFile(configPath, configContent);
  logger.success("Created payloadcmsdirectory.config.js");
}

async function installPlugins() {
  const { installShadcn } = await inquirer.prompt([
    {
      type: "confirm",
      name: "installShadcn",
      message: "Would you like to install the Shadcn UI plugin?",
      default: true,
    },
  ]);

  if (installShadcn) {
    const packageManager = detectPackageManager();
    const spinner = ora("Installing @payloadcmsdirectory/shadcn-ui...").start();

    try {
      execSync(`${packageManager} add @payloadcmsdirectory/shadcn-ui`, {
        stdio: "ignore",
      });

      // Update the config file
      const configPath = path.join(
        process.cwd(),
        "payloadcmsdirectory.config.js",
      );
      let configContent = await fs.readFile(configPath, "utf8");

      // Add the plugin to the plugins array
      configContent = configContent.replace(
        "plugins: []",
        "plugins: ['@payloadcmsdirectory/shadcn-ui']",
      );

      await fs.writeFile(configPath, configContent);

      spinner.succeed("Installed @payloadcmsdirectory/shadcn-ui");
    } catch (error) {
      spinner.fail("Failed to install @payloadcmsdirectory/shadcn-ui");
      logger.error(
        `Failed to install @payloadcmsdirectory/shadcn-ui: ${error}`,
      );
    }
  }
}
