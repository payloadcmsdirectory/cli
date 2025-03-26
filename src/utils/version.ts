// Load the package.json file to get the version
let packageVersion: string;

try {
  // Read the package.json to get the current version
  const packageJson = require("../../package.json");
  packageVersion = packageJson.version;
} catch (error) {
  // Fallback version if package.json cannot be read
  packageVersion = "0.1.9";
}

export { packageVersion };
