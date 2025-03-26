import { execSync } from "child_process";
import path from "path";
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
      this.spinner.warn("Tailwind CSS not detected");
      const { installTailwind } = await inquirer.prompt([
        {
          type: "confirm",
          name: "installTailwind",
          message: "Would you like to install Tailwind CSS?",
          default: true,
        },
      ]);

      if (!installTailwind) {
        return false;
      }

      // Install Tailwind
      const packageManager = detectPackageManager();
      this.spinner.start("Installing Tailwind CSS...");

      try {
        execSync(
          `${packageManager} add -D tailwindcss@latest postcss autoprefixer`,
          { stdio: "ignore" },
        );
        this.spinner.succeed("Installed Tailwind CSS");
      } catch (error) {
        this.spinner.fail("Failed to install Tailwind CSS");
        return false;
      }
    }

    return true;
  }

  async install(options: PluginOptions): Promise<void> {
    this.spinner.start("Installing ShadcnUI plugin...");

    try {
      // Get CSS file path first
      const { cssPath } = await inquirer.prompt([
        {
          type: "input",
          name: "cssPath",
          message:
            "Enter the path to your main CSS file (or leave as is to create one):",
          default: "src/app/(payload)/custom.scss",
        },
      ]);

      this.cssPath = cssPath;

      // Validate environment first
      if (!(await this.validateEnvironment())) {
        throw new Error("Environment validation failed");
      }

      // Show configuration summary
      console.log("\n===== Configuration Files =====");
      const tailwindPath =
        (await findConfigFile(["tailwind.config.ts", "tailwind.config.js"])) ||
        "tailwind.config.js";
      const postCssPath =
        (await findConfigFile(["postcss.config.js", "postcss.config.ts"])) ||
        "postcss.config.js";
      const payloadConfigPath =
        (await findConfigFile([
          "src/payload.config.ts",
          "payload.config.ts",
          "src/payload.config.js",
          "payload.config.js",
        ])) || "src/payload.config.ts";

      console.log("\nConfiguration files to create/modify:");
      console.log(`- Tailwind config: ${path.resolve(tailwindPath)}`);
      console.log(`- PostCSS config: ${path.resolve(postCssPath)}`);
      console.log(`- CSS file: ${path.resolve(this.cssPath)}`);
      console.log(`- Payload config: ${path.resolve(payloadConfigPath)}`);

      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Are these paths correct?",
          default: true,
        },
      ]);

      if (!confirm) {
        const { customPayloadConfig } = await inquirer.prompt([
          {
            type: "input",
            name: "customPayloadConfig",
            message: "Enter the path to your Payload config file:",
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

      this.spinner.succeed("Successfully installed ShadcnUI plugin");
    } catch (error) {
      this.spinner.fail("Failed to install ShadcnUI plugin");
      if (error instanceof Error) {
        logger.error(`Error: ${error.message}`);
      }
      throw error;
    }
  }

  private async updateTailwindConfig(): Promise<void> {
    const configPath = await findConfigFile([
      "tailwind.config.ts",
      "tailwind.config.js",
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
