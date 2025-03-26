import fs from "fs-extra";

export * from "./base";
export * from "./types";
export * from "./shadcn";

// Utility functions
export const findConfigFile = async (
  possiblePaths: string[],
): Promise<string | null> => {
  for (const path of possiblePaths) {
    try {
      await fs.access(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
};

export const checkTailwindVersion = async (): Promise<{ version: number }> => {
  try {
    const packageJson = await fs.readJson("package.json");
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    const version = dependencies["tailwindcss"] ? 1 : 0;
    return { version };
  } catch {
    return { version: 0 };
  }
};
