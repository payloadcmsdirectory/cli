import path from "path";
import fs from "fs-extra";

import { logger } from "./logger";

interface ConfigTemplate {
  name: string;
  content: string;
  validate: (content: string) => ConfigValidation;
}

interface ConfigValidation {
  isValid: boolean;
  format: "esm" | "commonjs" | null;
  hasRequiredContent: boolean;
}

interface ConfigFile {
  path: string;
  template: ConfigTemplate;
  backupPath?: string;
}

// Configuration templates
export const CONFIG_TEMPLATES = {
  postcss: {
    name: "PostCSS",
    content: `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};`,
    validate: (content: string): ConfigValidation => {
      const isESM = content.includes("export default");
      const isCommonJS = content.includes("module.exports");
      const hasRequiredContent = content.includes("@tailwindcss/postcss");

      return {
        isValid: (isESM || isCommonJS) && hasRequiredContent,
        format: isESM ? "esm" : isCommonJS ? "commonjs" : null,
        hasRequiredContent,
      };
    },
  },
  tailwind: {
    name: "Tailwind",
    content: `import { type Config } from "tailwindcss";
import { getShadcnContent } from "@payloadcmsdirectory/shadcn-ui";

export default {
  content: [
    ...getShadcnContent(),
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;`,
    validate: (content: string): ConfigValidation => {
      const isESM = content.includes("export default");
      const isCommonJS = content.includes("module.exports");
      const hasRequiredContent = content.includes("getShadcnContent()");

      return {
        isValid: (isESM || isCommonJS) && hasRequiredContent,
        format: isESM ? "esm" : isCommonJS ? "commonjs" : null,
        hasRequiredContent,
      };
    },
  },
  css: {
    name: "CSS",
    content: `@import "@payloadcmsdirectory/shadcn-ui/globals.css";

@tailwind base;
@tailwind components;
@tailwind utilities;`,
    validate: (content: string): ConfigValidation => {
      const hasRequiredContent = content.includes(
        "@payloadcmsdirectory/shadcn-ui/globals.css",
      );

      return {
        isValid: hasRequiredContent,
        format: null, // CSS files don't have ESM/CommonJS format
        hasRequiredContent,
      };
    },
  },
} as const;

export class ConfigHandler {
  private configs: ConfigFile[] = [];

  constructor() {}

  addConfig(filePath: string, template: ConfigTemplate) {
    this.configs.push({
      path: filePath,
      template,
    });
  }

  async validateConfigs() {
    const results = [];

    for (const config of this.configs) {
      const exists = await fs.pathExists(config.path);
      if (!exists) {
        results.push({
          name: config.template.name,
          path: config.path,
          needsUpdate: true,
          exists: false,
        });
        continue;
      }

      const content = await fs.readFile(config.path, "utf8");
      const validation = config.template.validate(content);

      results.push({
        name: config.template.name,
        path: config.path,
        needsUpdate: !validation.isValid,
        exists: true,
        validation,
      });
    }

    return results;
  }

  async createBackups() {
    const backups = [];

    for (const config of this.configs) {
      if (await fs.pathExists(config.path)) {
        const backupPath = config.path + ".bak";
        await fs.copy(config.path, backupPath);
        config.backupPath = backupPath;
        backups.push({ original: config.path, backup: backupPath });
      }
    }

    return backups;
  }

  async updateConfigs() {
    const updated = [];

    for (const config of this.configs) {
      const validation = await this.validateSingleConfig(config);

      if (!validation || !validation.isValid) {
        await fs.writeFile(config.path, config.template.content);
        updated.push(config.path);
      }
    }

    return updated;
  }

  private async validateSingleConfig(config: ConfigFile) {
    if (!(await fs.pathExists(config.path))) return null;

    const content = await fs.readFile(config.path, "utf8");
    return config.template.validate(content);
  }
}

// Helper function to create a new config handler with standard shadcn-ui configs
export function createShadcnConfigHandler(
  postcssPath: string,
  tailwindPath: string,
  cssPath: string,
) {
  const handler = new ConfigHandler();

  handler.addConfig(postcssPath, CONFIG_TEMPLATES.postcss);
  handler.addConfig(tailwindPath, CONFIG_TEMPLATES.tailwind);
  handler.addConfig(cssPath, CONFIG_TEMPLATES.css);

  return handler;
}
