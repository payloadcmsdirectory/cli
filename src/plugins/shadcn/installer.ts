import { execSync } from "child_process";
import path from "path";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";

import { logger } from "../../utils/logger";
import { detectPackageManager } from "../../utils/packageManager";
import { checkTailwindVersion, findConfigFile } from "../../utils/plugins";
import { BasePluginInstaller } from "../base";
import { PluginOptions } from "../types";
import { SHADCN_TEMPLATES } from "./templates";

export class ShadcnPluginInstaller extends BasePluginInstaller {
  private cssPath: string = "";

  getPackageName(): string {
    return "@payloadcms/plugin-shadcn";
  }

  protected getPluginConfig(): string {
    return `
    shadcnPlugin({
      enableAll: true,
      customScssPath: "${this.cssPath || "src/app/(payload)/custom.scss"}",
      injectStyles: false,
      customCSS: \`
        /* Add any additional custom CSS here */
        :root {
          --custom-color: #ff0000;
        }
      \`,
    })`;
  }

  async validateEnvironment(): Promise<boolean> {
    // Check Tailwind version
    const { version: tailwindVersion } = await checkTailwindVersion();

    if (tailwindVersion === 0) {
      this.spinner.warn(chalk.yellow("⚠️ Tailwind CSS not detected"));
      const { installTailwind } = await inquirer.prompt([
        {
          type: "confirm",
          name: "installTailwind",
          message: chalk.cyan("Would you like to install Tailwind CSS?"),
          default: true,
        },
      ]);

      if (!installTailwind) {
        return false;
      }

      // Install Tailwind
      const packageManager = detectPackageManager();
      this.spinner.start(
        chalk.blue("Installing Tailwind CSS and dependencies..."),
      );

      try {
        execSync(
          `${packageManager} add -D tailwindcss@latest @tailwindcss/postcss@latest postcss autoprefixer`,
          { stdio: "ignore" },
        );
        this.spinner.succeed(
          chalk.green("✅ Installed Tailwind CSS and dependencies"),
        );
      } catch (error) {
        this.spinner.fail(chalk.red("❌ Failed to install Tailwind CSS"));
        return false;
      }
    } else if (tailwindVersion < 4) {
      this.spinner.warn(
        chalk.yellow("\n⚠️ Tailwind CSS v" + tailwindVersion + " detected"),
      );
      console.log(
        chalk.yellow(
          "The ShadcnUI plugin works best with Tailwind CSS v4 or later.\n" +
            "We recommend upgrading to the latest version for the best experience.",
        ),
      );

      const { upgradeNow } = await inquirer.prompt([
        {
          type: "confirm",
          name: "upgradeNow",
          message: chalk.cyan("Would you like to upgrade Tailwind CSS to v4?"),
          default: true,
        },
      ]);

      if (upgradeNow) {
        const packageManager = detectPackageManager();
        this.spinner.start(
          chalk.blue("Upgrading Tailwind CSS and dependencies..."),
        );

        try {
          execSync(
            `${packageManager} add -D tailwindcss@latest @tailwindcss/postcss@latest`,
            { stdio: "ignore" },
          );
          this.spinner.succeed(
            chalk.green("✅ Upgraded Tailwind CSS and dependencies to v4"),
          );
        } catch (error) {
          this.spinner.fail(chalk.red("❌ Failed to upgrade Tailwind CSS"));
          console.log(
            chalk.yellow(
              "\nYou can manually upgrade later using:\n" +
                chalk.white(
                  `${packageManager} add -D tailwindcss@latest @tailwindcss/postcss@latest`,
                ),
            ),
          );
        }
      } else {
        console.log(
          chalk.dim(
            "\nYou can manually upgrade later using:\n" +
              chalk.white(
                `${detectPackageManager()} add -D tailwindcss@latest @tailwindcss/postcss@latest`,
              ),
          ),
        );
      }
    }

    return true;
  }

  async install(options: PluginOptions): Promise<void> {
    console.log(
      "\n" + chalk.blue.bold("🎨 Installing ShadcnUI plugin...") + "\n",
    );

    try {
      // Get CSS file path first
      const { cssPath } = await inquirer.prompt([
        {
          type: "input",
          name: "cssPath",
          message:
            chalk.cyan("Enter the path to your main CSS file:") +
            "\n" +
            chalk.dim(
              "(Press Enter to use default: src/app/(payload)/custom.scss)",
            ) +
            "\n" +
            chalk.cyan("➜ "),
          default: "src/app/(payload)/custom.scss",
        },
      ]);

      this.cssPath = cssPath;

      // Validate environment first
      if (!(await this.validateEnvironment())) {
        throw new Error("Environment validation failed");
      }

      // Show configuration summary
      console.log("\n" + chalk.yellow.bold("📁 Configuration Files") + "\n");

      const tailwindPath =
        (await findConfigFile([
          "tailwind.config.ts",
          "tailwind.config.js",
          "tailwind.config.mjs",
          "tailwind.config.cjs",
        ])) || "tailwind.config.js";

      const postCssPath =
        (await findConfigFile([
          "postcss.config.js",
          "postcss.config.ts",
          "postcss.config.mjs",
          "postcss.config.cjs",
        ])) || "postcss.config.js";

      const payloadConfigPath =
        (await findConfigFile([
          "src/payload.config.ts",
          "payload.config.ts",
          "src/payload.config.js",
          "payload.config.js",
          "src/payload.config.mjs",
          "payload.config.mjs",
        ])) || "src/payload.config.ts";

      console.log(
        chalk.dim("The following files will be created or modified:"),
      );
      console.log(
        chalk.cyan("• Tailwind config: ") +
          chalk.white(path.resolve(tailwindPath)),
      );
      console.log(
        chalk.cyan("• PostCSS config:  ") +
          chalk.white(path.resolve(postCssPath)),
      );
      console.log(
        chalk.cyan("• CSS file:       ") +
          chalk.white(path.resolve(this.cssPath)),
      );
      console.log(
        chalk.cyan("• Payload config: ") +
          chalk.white(path.resolve(payloadConfigPath)),
      );

      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: chalk.green("\nAre these paths correct?"),
          default: true,
        },
      ]);

      if (!confirm) {
        const { customPayloadConfig } = await inquirer.prompt([
          {
            type: "input",
            name: "customPayloadConfig",
            message:
              chalk.cyan("Enter the path to your Payload config file:") +
              "\n" +
              chalk.dim(
                "(Press Enter to use default: " + payloadConfigPath + ")",
              ) +
              "\n" +
              chalk.cyan("➜ "),
            default: payloadConfigPath,
          },
        ]);

        if (!(await fs.pathExists(customPayloadConfig))) {
          throw new Error(
            `Payload config file not found at: ${customPayloadConfig}`,
          );
        }
      }

      // Update Tailwind config
      await this.updateTailwindConfig();

      // Update PostCSS config
      await this.updatePostCSSConfig();

      // Update global CSS
      await this.updateGlobalCSS();

      // Update Payload config
      await this.updatePayloadConfigFile();

      this.spinner.succeed(
        chalk.green("✅ Successfully installed ShadcnUI plugin"),
      );

      console.log("\n" + chalk.blue.bold("Next steps:"));
      console.log(chalk.dim("1. Start your development server"));
      console.log(
        chalk.dim("2. Check your CSS file at: ") + chalk.cyan(this.cssPath),
      );
      console.log(chalk.dim("3. Verify Tailwind and PostCSS configurations"));
    } catch (error) {
      this.spinner.fail(chalk.red("❌ Failed to install ShadcnUI plugin"));
      if (error instanceof Error) {
        logger.error(chalk.red(`Error: ${error.message}`));
      }
      throw error;
    }
  }

  private async updateTailwindConfig(): Promise<void> {
    const configPath = await findConfigFile([
      "tailwind.config.ts",
      "tailwind.config.js",
      "tailwind.config.mjs",
      "tailwind.config.cjs",
    ]);

    if (!configPath) {
      throw new Error("Could not find Tailwind config file");
    }

    // Read current config
    let configContent = await fs.readFile(configPath, "utf-8");

    // Add shadcn content function if not present
    if (!configContent.includes("getShadcnContent")) {
      configContent = SHADCN_TEMPLATES.CONTENT_FUNCTION + "\n" + configContent;
    }

    // Update content array
    const contentMatch = configContent.match(/content\s*:\s*\[([\s\S]*?)\]/);
    if (contentMatch) {
      const currentContent = contentMatch[1];
      if (!currentContent.includes("getShadcnContent")) {
        const newContent = currentContent.trim()
          ? `content: [${currentContent}, ...getShadcnContent()]`
          : `content: [...getShadcnContent()]`;

        configContent = configContent.replace(
          /content\s*:\s*\[([\s\S]*?)\]/,
          newContent,
        );
      }
    }

    await fs.writeFile(configPath, configContent);
  }

  private async updatePostCSSConfig(): Promise<void> {
    const configPath = await findConfigFile([
      "postcss.config.js",
      "postcss.config.ts",
      "postcss.config.mjs",
      "postcss.config.cjs",
    ]);

    // Always write the new config, regardless of whether it exists
    await fs.writeFile(
      configPath || "postcss.config.js",
      SHADCN_TEMPLATES.POSTCSS_CONFIG,
    );
  }

  private async updateGlobalCSS(): Promise<void> {
    // Ensure directory exists
    await fs.ensureDir(path.dirname(this.cssPath));

    // Create or update the CSS file
    await fs.writeFile(this.cssPath, SHADCN_TEMPLATES.CSS_IMPORT);
  }
}
