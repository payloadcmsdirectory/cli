import path from "path";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";

import { logger } from "../utils/logger";
import { createSection, listItem } from "../utils/ui";
import { initConfigCommand } from "./initConfig";

// Collection templates
const COLLECTION_TEMPLATES = {
  posts: {
    name: "Posts",
    description: "Blog posts or articles with title, content, and metadata",
  },
  pages: {
    name: "Pages",
    description: "Static content pages with flexible layout options",
  },
  courses: {
    name: "Courses",
    description: "Educational content with modules, lessons, and enrollment",
  },
  products: {
    name: "Products",
    description: "E-commerce products with pricing, variants, and inventory",
  },
};

interface GenerateCollectionOptions {
  yes?: boolean;
  dryRun?: boolean;
}

/**
 * Check if we should prompt for copying templates locally
 */
async function shouldCopyTemplates(config: any): Promise<boolean> {
  // If templates.useLocal is already true, no need to copy templates
  if (config.templates?.useLocal === true) {
    return false;
  }

  // If templates directory exists with content, don't prompt again
  const templatesDir = config.templates?.path || ".payload/templates";
  try {
    if (await fs.pathExists(templatesDir)) {
      const templates = await fs.readdir(templatesDir);
      if (templates.length > 0) {
        return false;
      }
    }
  } catch (error) {
    // Ignore errors reading directory
  }

  // Ask the user if they want to copy templates
  const { shouldCopy } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldCopy",
      message:
        "Would you like to copy collection templates to your local project for customization?",
      default: false,
    },
  ]);

  return shouldCopy;
}

/**
 * Copy built-in templates to local project
 */
async function copyTemplatesToLocal(config: any): Promise<void> {
  const templatesDir = config.templates?.path || ".payload/templates";
  const spinner = ora(
    "Copying collection templates to local project...",
  ).start();

  try {
    // Ensure templates directory exists
    await fs.ensureDir(templatesDir);

    // Copy each template to local directory
    for (const [key, template] of Object.entries(COLLECTION_TEMPLATES)) {
      const templateDir = path.join(templatesDir, key);
      await fs.ensureDir(templateDir);

      // Create an index.ts file with the template definition
      await fs.writeFile(
        path.join(templateDir, "index.ts"),
        generateCollectionCode(toPascalCase(key), key),
      );

      // Create a template.json file with metadata
      await fs.writeFile(
        path.join(templateDir, "template.json"),
        JSON.stringify(
          {
            name: (template as any).name,
            description: (template as any).description,
          },
          null,
          2,
        ),
      );
    }

    // Update config to use local templates
    await updateConfigToUseLocalTemplates(config);

    spinner.succeed("Collection templates copied to local project");

    console.log();
    logger.info("Templates directory:");
    listItem(chalk.cyan(templatesDir));

    console.log();
    logger.info("You can now customize these templates for future collections");
  } catch (error: unknown) {
    spinner.fail("Failed to copy templates");
    if (error instanceof Error) {
      logger.error(`Error copying templates: ${error.message}`);
    } else {
      logger.error("An unknown error occurred");
    }
  }
}

/**
 * Update config to use local templates
 */
async function updateConfigToUseLocalTemplates(config: any): Promise<void> {
  // Check if config file exists
  if (await fs.pathExists("payloadcli.config.js")) {
    try {
      let configContent = await fs.readFile("payloadcli.config.js", "utf8");

      // Check if templates section exists
      if (!configContent.includes("templates:")) {
        // Add templates section
        configContent = configContent.replace(
          /module\.exports\s*=\s*{/,
          `module.exports = {\n  templates: {\n    path: ".payload/templates",\n    useLocal: true,\n  },`,
        );
      } else {
        // Update useLocal to true
        configContent = configContent.replace(
          /useLocal:\s*false/,
          "useLocal: true",
        );
      }

      await fs.writeFile("payloadcli.config.js", configContent);
    } catch (error) {
      logger.debug(`Error updating config: ${error}`);
    }
  }
}

/**
 * Command to generate a new collection
 */
export async function generateCollectionCommand(
  collectionName: string | undefined,
  options: GenerateCollectionOptions,
) {
  createSection("Generate Collection", "Create a new PayloadCMS collection");

  // Check for config file first
  const configExists =
    (await fs.pathExists("payloadcli.config.cjs")) ||
    (await fs.pathExists("payload-cli-config.cjs")) ||
    (await fs.pathExists("payloadcli.config.js"));
  let config: any = {};

  if (!configExists) {
    logger.info("No configuration file found.");
    const { setupConfig } = await inquirer.prompt([
      {
        type: "confirm",
        name: "setupConfig",
        message: "Would you like to set up a configuration file first?",
        default: true,
      },
    ]);

    if (setupConfig) {
      await initConfigCommand({});
      // Load the newly created config
      config = await loadConfig();
    } else {
      config = {
        collections: { path: "src/collections" },
        globals: { path: "src/globals" },
        templates: { path: ".payload/templates", useLocal: false },
      };
    }
  } else {
    config = await loadConfig();
  }

  // Check if we should copy templates locally
  if (await shouldCopyTemplates(config)) {
    await copyTemplatesToLocal(config);
  }

  // If no collection name is provided, prompt for one
  if (!collectionName) {
    const { name } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "What should the collection be named?",
        validate: (input: string) => {
          if (!input.trim()) return "Collection name is required";
          // Convert to PascalCase for the validation check
          const pascalCase = input
            .trim()
            .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
            .replace(/^(.)/, (c) => c.toUpperCase());

          if (!/^[A-Z][a-zA-Z0-9]*$/.test(pascalCase)) {
            return "Collection name must be a valid PascalCase identifier";
          }
          return true;
        },
      },
    ]);
    collectionName = name.trim();
  }

  // Safety check - ensure we have a collection name
  if (!collectionName) {
    logger.error("Collection name is required");
    return;
  }

  // Convert to PascalCase for the collection name
  const pascalCaseName = collectionName
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toUpperCase());

  // Ask for generation type
  const { generationType } = await inquirer.prompt([
    {
      type: "list",
      name: "generationType",
      message: "How would you like to create this collection?",
      choices: [
        { name: "Use a template", value: "template" },
        { name: "Clone an existing collection", value: "clone" },
        { name: "Start fresh (coming soon)", value: "fresh", disabled: true },
      ],
    },
  ]);

  switch (generationType) {
    case "template":
      await generateFromTemplate(pascalCaseName, options);
      break;
    case "clone":
      await cloneExistingCollection(pascalCaseName, options);
      break;
    case "fresh":
      logger.info("Starting fresh is not yet implemented.");
      break;
    default:
      logger.error("Invalid generation type selected.");
      break;
  }
}

/**
 * Generate a collection from a template
 */
async function generateFromTemplate(
  collectionName: string,
  options: GenerateCollectionOptions,
) {
  // Get config and set up paths
  const config = await loadConfig();
  const collectionsDir = config.collections?.path || "src/collections";
  const templatesDir = config.templates?.path || ".payload/templates";
  const useLocalTemplates = config.templates?.useLocal || false;

  // Check for local templates
  let localTemplatesAvailable = false;
  let localTemplates: Record<string, any> = {};

  if (useLocalTemplates) {
    try {
      if (await fs.pathExists(templatesDir)) {
        const templateDirs = await fs.readdir(templatesDir, {
          withFileTypes: true,
        });

        // Loop through template directories
        for (const dir of templateDirs) {
          if (dir.isDirectory()) {
            const templateJsonPath = path.join(
              templatesDir,
              dir.name,
              "template.json",
            );

            if (await fs.pathExists(templateJsonPath)) {
              try {
                const templateData = await fs.readJSON(templateJsonPath);
                localTemplates[dir.name] = {
                  name: templateData.name || dir.name,
                  description: templateData.description || "",
                  path: path.join(templatesDir, dir.name),
                };
                localTemplatesAvailable = true;
              } catch (error) {
                // Ignore error reading template json
              }
            }
          }
        }
      }
    } catch (error) {
      // If we can't read local templates, fall back to built-in ones
      logger.debug(`Error reading local templates: ${error}`);
    }
  }

  // Show template choices
  const templateChoices = localTemplatesAvailable
    ? Object.entries(localTemplates).map(([key, value]) => ({
        name: `${value.name} - ${chalk.gray(value.description)} ${chalk.green("(Local)")}`,
        value: { key, local: true },
      }))
    : Object.entries(COLLECTION_TEMPLATES).map(([key, value]) => ({
        name: `${value.name} - ${chalk.gray(value.description)}`,
        value: { key, local: false },
      }));

  const { template } = await inquirer.prompt([
    {
      type: "list",
      name: "template",
      message: "Select a template:",
      choices: templateChoices,
    },
  ]);

  // Ensure directory exists
  await fs.ensureDir(collectionsDir);

  // Create collection folder
  const collectionDir = path.join(collectionsDir, camelCase(collectionName));
  await fs.ensureDir(collectionDir);

  const spinner = ora(
    `Generating ${chalk.cyan(collectionName)} collection...`,
  ).start();

  try {
    // Generate files based on template
    if (template.local) {
      // Using local template
      await generateFromLocalTemplate(
        collectionName,
        template.key,
        localTemplates[template.key].path,
        collectionDir,
      );
    } else {
      // Using built-in template
      await generateCollectionFiles(
        collectionName,
        template.key,
        collectionDir,
      );
    }

    // Update Payload config to include the new collection
    await updatePayloadConfig(collectionName, collectionsDir);

    spinner.succeed(
      `${chalk.green(collectionName)} collection generated successfully!`,
    );

    // Display next steps
    console.log();
    logger.info("Next steps:");
    listItem("Customize your collection fields in the generated files", "1️⃣");
    listItem("Restart your Payload server to see the changes", "2️⃣");
    listItem("Access your collection in the Payload admin panel", "3️⃣");
  } catch (error: unknown) {
    spinner.fail(`Failed to generate ${chalk.red(collectionName)} collection`);
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error("An unknown error occurred");
    }
  }
}

/**
 * Generate collection from a local template
 */
async function generateFromLocalTemplate(
  collectionName: string,
  templateKey: string,
  templatePath: string,
  collectionDir: string,
) {
  // Copy template files to collection directory
  await fs.copy(templatePath, collectionDir, {
    filter: (src: string) => {
      // Skip template.json
      return !src.endsWith("template.json");
    },
  });

  // Update collection name in all files
  const files = await fs.readdir(collectionDir);

  for (const file of files) {
    if (file.endsWith(".ts") || file.endsWith(".js")) {
      const filePath = path.join(collectionDir, file);
      let content = await fs.readFile(filePath, "utf8");

      // Extract template collection name
      const templateName = toPascalCase(templateKey);

      // Replace all occurrences of the template name with the new collection name
      content = content.replace(new RegExp(templateName, "g"), collectionName);

      // Update slug
      content = content.replace(
        new RegExp(`slug: "${camelCase(templateKey)}"`, "g"),
        `slug: "${camelCase(collectionName)}"`,
      );

      await fs.writeFile(filePath, content);
    }
  }
}

/**
 * Clone an existing collection
 */
async function cloneExistingCollection(
  collectionName: string,
  options: GenerateCollectionOptions,
) {
  // Get config and set up paths
  const config = await loadConfig();
  const collectionsDir = config.collections?.path || "src/collections";

  // Find existing collections
  const collections = await findExistingCollections(collectionsDir);

  if (collections.length === 0) {
    logger.error("No existing collections found to clone.");
    return;
  }

  // Show existing collections to choose from
  const { sourceCollection } = await inquirer.prompt([
    {
      type: "list",
      name: "sourceCollection",
      message: "Select a collection to clone:",
      choices: collections.map((col) => ({
        name: col.name,
        value: col.path,
      })),
    },
  ]);

  const spinner = ora(
    `Cloning ${chalk.cyan(collectionName)} from existing collection...`,
  ).start();

  try {
    // Clone the collection
    await cloneCollection(sourceCollection, collectionName, collectionsDir);

    // Update Payload config to include the new collection
    await updatePayloadConfig(collectionName, collectionsDir);

    spinner.succeed(
      `${chalk.green(collectionName)} collection cloned successfully!`,
    );

    // Display next steps
    console.log();
    logger.info("Next steps:");
    listItem("Review and customize your cloned collection", "1️⃣");
    listItem("Restart your Payload server to see the changes", "2️⃣");
    listItem("Access your collection in the Payload admin panel", "3️⃣");
  } catch (error: unknown) {
    spinner.fail(`Failed to clone ${chalk.red(collectionName)} collection`);
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error("An unknown error occurred");
    }
  }
}

/**
 * Load CLI configuration
 */
async function loadConfig() {
  try {
    // Check for .cjs extension file first (for projects with "type": "module")
    if (
      (await fs.pathExists("payload-cli-config.cjs")) ||
      (await fs.pathExists("payloadcli.config.cjs"))
    ) {
      const cjsPath = (await fs.pathExists("payload-cli-config.cjs"))
        ? "payload-cli-config.cjs"
        : "payloadcli.config.cjs";

      try {
        return require(path.resolve(cjsPath));
      } catch (requireError) {
        logger.debug(`Error loading CJS config: ${requireError}`);
      }
    }

    // Try the alternative config name
    if (await fs.pathExists("payload-cli-config.js")) {
      try {
        return require(path.resolve("payload-cli-config.js"));
      } catch (requireError) {
        logger.debug(`Error loading alternative config: ${requireError}`);
      }
    }

    // Check for payloadcli.config.js
    if (await fs.pathExists("payloadcli.config.js")) {
      // Use dynamic import instead of require to handle both ESM and CommonJS
      try {
        // Try importing as ESM first
        const configModule = await import(path.resolve("payloadcli.config.js"));
        return configModule.default || configModule;
      } catch (importError) {
        // Fallback to require for CommonJS
        try {
          // Delete require cache to ensure fresh load
          delete require.cache[
            require.resolve(path.resolve("payloadcli.config.js"))
          ];
          return require(path.resolve("payloadcli.config.js"));
        } catch (requireError) {
          logger.debug(`Error loading config: ${requireError}`);
          throw requireError;
        }
      }
    }

    // Then check for payload.config.ts for inferring paths
    if (await fs.pathExists("src/payload.config.ts")) {
      // We don't load the file directly to avoid TS dependencies
      // Just use default paths
      return {
        collections: {
          path: "src/collections",
        },
        globals: {
          path: "src/globals",
        },
      };
    }

    // Default configuration
    return {
      collections: {
        path: "src/collections",
      },
      globals: {
        path: "src/globals",
      },
    };
  } catch (error) {
    logger.debug(`Error loading config: ${error}`);
    // Return default config
    return {
      collections: {
        path: "src/collections",
      },
      globals: {
        path: "src/globals",
      },
    };
  }
}

/**
 * Find existing collections in the project
 */
async function findExistingCollections(collectionsDir: string) {
  try {
    if (!(await fs.pathExists(collectionsDir))) {
      return [];
    }

    const entries = await fs.readdir(collectionsDir, { withFileTypes: true });
    const collections = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        collections.push({
          name: entry.name,
          path: path.join(collectionsDir, entry.name),
        });
      }
    }

    return collections;
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error finding existing collections: ${error.message}`);
    } else {
      logger.error("Error finding existing collections");
    }
    return [];
  }
}

/**
 * Generate collection files based on template
 */
async function generateCollectionFiles(
  collectionName: string,
  templateKey: string,
  collectionDir: string,
) {
  // Create collection files based on template
  await fs.writeFile(
    path.join(collectionDir, "index.ts"),
    generateCollectionCode(collectionName, templateKey),
  );
}

/**
 * Clone an existing collection
 */
async function cloneCollection(
  sourcePath: string,
  newCollectionName: string,
  collectionsDir: string,
) {
  const targetDir = path.join(collectionsDir, camelCase(newCollectionName));

  // Create target directory
  await fs.ensureDir(targetDir);

  // Copy all files from source to target
  await fs.copy(sourcePath, targetDir);

  // Update collection name in files
  const files = await fs.readdir(targetDir);

  for (const file of files) {
    if (file.endsWith(".ts") || file.endsWith(".js")) {
      const filePath = path.join(targetDir, file);
      let content = await fs.readFile(filePath, "utf8");

      // Extract source collection name from path
      const sourceCollectionName = path.basename(sourcePath);
      const sourcePascalCase = toPascalCase(sourceCollectionName);

      // Replace all occurrences of the collection name
      content = content.replace(
        new RegExp(sourcePascalCase, "g"),
        newCollectionName,
      );

      await fs.writeFile(filePath, content);
    }
  }
}

/**
 * Generate collection code based on template
 */
function generateCollectionCode(collectionName: string, templateKey: string) {
  const camelCaseName = camelCase(collectionName);

  // Get template specific fields
  let fields;

  switch (templateKey) {
    case "posts":
      fields = `
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "publishedDate",
      type: "date",
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "content",
      type: "richText",
      required: true,
    },
    {
      name: "excerpt",
      type: "textarea",
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
    },
    {
      name: "tags",
      type: "array",
      fields: [
        {
          name: "tag",
          type: "text",
        },
      ],
    },
    {
      name: "status",
      type: "select",
      options: [
        {
          label: "Draft",
          value: "draft",
        },
        {
          label: "Published",
          value: "published",
        },
      ],
      defaultValue: "draft",
      admin: {
        position: "sidebar",
      },
    },`;
      break;

    case "pages":
      fields = `
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "layout",
      type: "blocks",
      blocks: [
        // Add your own block references here
      ],
    },
    {
      name: "meta",
      type: "group",
      fields: [
        {
          name: "title",
          type: "text",
        },
        {
          name: "description",
          type: "textarea",
        },
        {
          name: "keywords",
          type: "text",
        },
      ],
    },
    {
      name: "parent",
      type: "relationship",
      relationTo: "pages",
      admin: {
        position: "sidebar",
      },
    },`;
      break;

    case "courses":
      fields = `
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "description",
      type: "richText",
    },
    {
      name: "modules",
      type: "array",
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
        },
        {
          name: "lessons",
          type: "array",
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
            },
            {
              name: "content",
              type: "richText",
              required: true,
            },
            {
              name: "video",
              type: "text",
              admin: {
                description: "URL to video content",
              },
            },
          ],
        },
      ],
    },
    {
      name: "instructor",
      type: "relationship",
      relationTo: "users",
    },
    {
      name: "duration",
      type: "text",
    },
    {
      name: "level",
      type: "select",
      options: [
        {
          label: "Beginner",
          value: "beginner",
        },
        {
          label: "Intermediate",
          value: "intermediate",
        },
        {
          label: "Advanced",
          value: "advanced",
        },
      ],
      defaultValue: "beginner",
    },`;
      break;

    case "products":
      fields = `
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "price",
      type: "number",
      required: true,
    },
    {
      name: "description",
      type: "richText",
    },
    {
      name: "images",
      type: "array",
      fields: [
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          required: true,
        },
        {
          name: "altText",
          type: "text",
        },
      ],
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
    },
    {
      name: "variants",
      type: "array",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
        },
        {
          name: "options",
          type: "array",
          fields: [
            {
              name: "value",
              type: "text",
              required: true,
            },
            {
              name: "priceModifier",
              type: "number",
              defaultValue: 0,
            },
          ],
        },
      ],
    },
    {
      name: "inventoryCount",
      type: "number",
      defaultValue: 0,
    },
    {
      name: "status",
      type: "select",
      options: [
        {
          label: "Draft",
          value: "draft",
        },
        {
          label: "Available",
          value: "available",
        },
        {
          label: "Sold Out",
          value: "soldOut",
        },
      ],
      defaultValue: "draft",
      admin: {
        position: "sidebar",
      },
    },`;
      break;

    default:
      fields = `
    {
      name: "title",
      type: "text",
      required: true,
    },`;
  }

  return `import { CollectionConfig } from "payload/types";

const ${collectionName}: CollectionConfig = {
  slug: "${camelCaseName}",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "updatedAt"],
  },
  access: {
    read: () => true,
  },
  fields: [${fields}
  ],
};

export default ${collectionName};
`;
}

/**
 * Update Payload config to include the new collection
 */
async function updatePayloadConfig(
  collectionName: string,
  collectionsDir: string,
) {
  // For now, we'll just provide instructions on how to update the config
  logger.info(chalk.yellow("Important:"));
  listItem(
    "You need to update your Payload config to include the new collection:",
    "⚠️",
  );

  const relativePath = path.relative("src", collectionsDir);
  const importPath = path.join(relativePath, camelCase(collectionName));

  console.log(
    chalk.cyan(`\n// In your payload.config.ts file:
import ${collectionName} from "${importPath}";

// Add to collections array
export default buildConfig({
  collections: [
    // ... existing collections
    ${collectionName},
  ],
});
`),
  );
}

/**
 * Convert string to camelCase
 */
function camelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => letter.toUpperCase())
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");
}
