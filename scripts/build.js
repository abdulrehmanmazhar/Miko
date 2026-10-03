import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const rootDir = resolve(import.meta.dirname, "..");
const projects = [
  {
    name: "frontend",
    directory: join(rootDir, "apps", "frontend"),
    destination: join(rootDir, "apps", "neutralino", "resources"),
  },
  {
    name: "server",
    directory: join(rootDir, "apps", "server"),
    destination: join(rootDir, "apps", "neutralino", "extensions"),
  },
];

await Promise.all(
  projects.map(({ name, directory }) => runBuild(name, directory)),
);

for (const project of projects) {
  const resources = readResources(project.directory, project.name);
  for (const resource of resources) {
    copyResource(project.directory, resource, project.destination);
    console.log(
      `Copied ${project.name}${resource} → ${project.destination}` +
        (resource.endsWith("/**") ? " (contents)" : ""),
    );
  }
}

await runBuild("neutralino", join(rootDir, "apps", "neutralino"));

function runBuild(name, directory) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  return new Promise((resolveBuild, rejectBuild) => {
    console.log(`Building ${name}...`);
    const child = spawn(npmCommand, ["run", "build"], {
      cwd: directory,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", rejectBuild);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolveBuild();
      } else {
        rejectBuild(
          new Error(`${name} build failed with exit code ${exitCode}`),
        );
      }
    });
  });
}

function readResources(directory, name) {
  const packageJsonPath = join(directory, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Missing package.json for ${name}: ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (!Array.isArray(packageJson.resources)) {
    throw new Error(
      `${name}: package.json "resources" must be an array of path strings`,
    );
  }

  for (const resource of packageJson.resources) {
    if (typeof resource !== "string" || !resource.startsWith("/")) {
      throw new Error(
        `${name}: invalid resource "${resource}" — expected a string starting with "/"`,
      );
    }
  }

  return packageJson.resources;
}

/**
 * `/dist`     → copy the folder into destination as `dist/`
 * `/dist/**`  → copy the folder's contents into destination (no parent folder)
 */
function copyResource(projectDirectory, resource, destination) {
  const copyContents = resource.endsWith("/**");
  const relativePath = (
    copyContents ? resource.slice(1, -3) : resource.slice(1)
  ).replace(/\/+$/, "");

  if (!relativePath) {
    throw new Error(`Invalid resource path: "${resource}"`);
  }

  const source = join(projectDirectory, ...relativePath.split("/"));
  if (!existsSync(source)) {
    throw new Error(`Build output does not exist: ${source}`);
  }

  mkdirSync(destination, { recursive: true });

  if (copyContents) {
    copyDirectoryContents(source, destination);
    return;
  }

  const target = join(destination, basename(source));
  cpSync(source, target, { recursive: true, force: true });
}

function copyDirectoryContents(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source)) {
    cpSync(join(source, entry), join(destination, entry), {
      recursive: true,
      force: true,
    });
  }
}
