import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = resolve(import.meta.dirname, "..");
const envPath = join(rootDir, ".env");
const neutralinoDistApp = join(rootDir, "apps", "neutralino", "dist", "todo");
const stagingRoot = join(rootDir, "dist", "msix");
const layoutDir = join(stagingRoot, "layout");
const assetsDir = join(layoutDir, "Assets");
const outputMsix = join(stagingRoot, "Todo.msix");

loadEnvFile(envPath);

const config = readMsixConfig();
assertWindowsSource(neutralinoDistApp, config.executable);

prepareStaging();
copyAppPayload(neutralinoDistApp, layoutDir, config.executable);
copyPackageAssets(assetsDir);
writeAppxManifest(join(layoutDir, "AppxManifest.xml"), config);

const makeAppx = findSdkTool("makeappx.exe");
if (!makeAppx) {
  console.warn(
    [
      "AppxManifest and package layout were created, but MakeAppx.exe was not found.",
      "Install the Windows 10/11 SDK (MakeAppx) and re-run: npm run msix",
      `Layout: ${layoutDir}`,
    ].join("\n"),
  );
  process.exit(0);
}

packMsix(makeAppx, layoutDir, outputMsix);
console.log(`MSIX created: ${outputMsix}`);

const certPath = process.env.MSIX_CERTIFICATE_PATH?.trim();
if (certPath) {
  const signTool = findSdkTool("signtool.exe");
  if (!signTool) {
    throw new Error(
      "MSIX_CERTIFICATE_PATH is set but SignTool.exe was not found in the Windows SDK.",
    );
  }
  signMsix(
    signTool,
    outputMsix,
    certPath,
    process.env.MSIX_CERTIFICATE_PASSWORD,
  );
  console.log(`MSIX signed: ${outputMsix}`);
}

function loadEnvFile(filePath) {
  try {
    process.loadEnvFile(filePath);
  } catch (error) {
    if (existsSync(filePath)) {
      throw error;
    }
    console.warn(
      `No .env found at ${filePath}. Using process env / defaults. See .env.example.`,
    );
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill Microsoft Store details.`,
    );
  }
  return value;
}

function readMsixConfig() {
  const version = process.env.MSIX_VERSION?.trim() || "1.0.0.0";
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `MSIX_VERSION must be a four-part version like 1.0.0.0 (got "${version}")`,
    );
  }

  return {
    identityName: requiredEnv("MSIX_IDENTITY_NAME"),
    publisher: requiredEnv("MSIX_PUBLISHER"),
    publisherDisplayName: requiredEnv("MSIX_PUBLISHER_DISPLAY_NAME"),
    displayName: process.env.MSIX_DISPLAY_NAME?.trim() || "Todo",
    description:
      process.env.MSIX_DESCRIPTION?.trim() ||
      "A sophisticated todo application.",
    version,
    executable: process.env.MSIX_EXECUTABLE?.trim() || "todo-win_x64.exe",
    architecture: process.env.MSIX_ARCHITECTURE?.trim() || "x64",
    minVersion: process.env.MSIX_MIN_VERSION?.trim() || "10.0.17763.0",
    maxVersionTested:
      process.env.MSIX_MAX_VERSION_TESTED?.trim() || "10.0.22621.0",
  };
}

function assertWindowsSource(sourceDir, executable) {
  if (!existsSync(sourceDir)) {
    throw new Error(
      `Neutralino Windows build not found at ${sourceDir}. Run npm run build first.`,
    );
  }
  const exePath = join(sourceDir, executable);
  if (!existsSync(exePath)) {
    throw new Error(`Missing Windows executable: ${exePath}`);
  }
  if (!existsSync(join(sourceDir, "resources.neu"))) {
    throw new Error(`Missing resources.neu in ${sourceDir}`);
  }
}

function prepareStaging() {
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(assetsDir, { recursive: true });
}

/**
 * Copy only what the Windows package needs:
 * - Windows executable
 * - resources.neu
 * - extensions/ (backend SEA + migrations)
 * Skip Linux/mac binaries, logs, and .tmp runtime junk.
 */
function copyAppPayload(sourceDir, destinationDir, executable) {
  copyFileSync(join(sourceDir, executable), join(destinationDir, executable));
  copyFileSync(
    join(sourceDir, "resources.neu"),
    join(destinationDir, "resources.neu"),
  );

  const extensionsSource = join(sourceDir, "extensions");
  if (existsSync(extensionsSource)) {
    cpSync(extensionsSource, join(destinationDir, "extensions"), {
      recursive: true,
      force: true,
      filter: (src) => {
        const name = basename(src).toLowerCase();
        if (name === ".tmp" || name.endsWith(".log")) return false;
        if (statSync(src).isDirectory()) return true;
        // Keep Windows backend + migrations; drop accidental non-Windows binaries.
        if (
          name.includes("-linux_") ||
          name.includes("-mac_") ||
          name.endsWith(".so") ||
          name.endsWith(".dylib")
        ) {
          return false;
        }
        return true;
      },
    });
  }
}

function copyPackageAssets(destinationAssetsDir) {
  const iconCandidates = [
    process.env.MSIX_ICON_PATH?.trim(),
    join(rootDir, "apps", "neutralino", "resources", "icons", "appIcon.png"),
  ].filter(Boolean);

  const iconPath = iconCandidates.find((candidate) => existsSync(candidate));
  if (!iconPath) {
    throw new Error(
      "No package icon found. Set MSIX_ICON_PATH or provide apps/neutralino/resources/icons/appIcon.png",
    );
  }

  // Store certification prefers correct sizes; one PNG is enough for local packaging.
  const assetNames = [
    "StoreLogo.png",
    "Square44x44Logo.png",
    "Square150x150Logo.png",
    "Wide310x150Logo.png",
    "SplashScreen.png",
  ];

  for (const name of assetNames) {
    copyFileSync(iconPath, join(destinationAssetsDir, name));
  }
}

function writeAppxManifest(manifestPath, config) {
  //   const xml = `<?xml version="1.0" encoding="utf-8"?>
  // <Package
  //   xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  //   xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  //   xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
  //   xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  //   IgnorableNamespaces="uap uap10 rescap">
  //   <Identity
  //     Name="${escapeXml(config.identityName)}"
  //     Publisher="${escapeXml(config.publisher)}"
  //     Version="${escapeXml(config.version)}"
  //     ProcessorArchitecture="${escapeXml(config.architecture)}" />
  //   <Properties>
  //     <DisplayName>${escapeXml(config.displayName)}</DisplayName>
  //     <PublisherDisplayName>${escapeXml(config.publisherDisplayName)}</PublisherDisplayName>
  //     <Description>${escapeXml(config.description)}</Description>
  //     <Logo>Assets\\StoreLogo.png</Logo>
  //   </Properties>
  //   <Dependencies>
  //     <TargetDeviceFamily
  //       Name="Windows.Desktop"
  //       MinVersion="${escapeXml(config.minVersion)}"
  //       MaxVersionTested="${escapeXml(config.maxVersionTested)}" />
  //   </Dependencies>
  //   <Resources>
  //     <Resource Language="en-us" />
  //   </Resources>
  //   <Applications>
  //     <Application
  //       Id="App"
  //       Executable="${escapeXml(config.executable)}"
  //       EntryPoint="Windows.FullTrustApplication">
  //       <uap:VisualElements
  //         DisplayName="${escapeXml(config.displayName)}"
  //         Description="${escapeXml(config.description)}"
  //         BackgroundColor="transparent"
  //         Square150x150Logo="Assets\\Square150x150Logo.png"
  //         Square44x44Logo="Assets\\Square44x44Logo.png">
  //         <uap:DefaultTile
  //           Wide310x150Logo="Assets\\Wide310x150Logo.png" />
  //         <uap:SplashScreen Image="Assets\\SplashScreen.png" />
  //       </uap:VisualElements>
  //     </Application>
  //     <Application
  //       Id="Server"
  //       Executable="extensions\\dist\\server.exe"
  //       EntryPoint="Windows.FullTrustApplication"
  //       uap10:RuntimeBehavior="packagedClassicApp"
  //       uap10:TrustLevel="mediumIL">

  //       <uap:VisualElements
  //           AppListEntry="none"
  //           DisplayName="Figgo Todo Server"
  //           Description="Figgo Todo backend service."
  //           BackgroundColor="#FFFFFF"
  //           Square150x150Logo="Assets\\Square150x150Logo.png"
  //           Square44x44Logo="Assets\\Square44x44Logo.png" />

  //     </Application>
  //   </Applications>
  //   <Capabilities>
  //     <rescap:Capability Name="runFullTrust" />
  //   </Capabilities>
  // </Package>
  // `;

  const xml = `<?xml version="1.0" encoding="utf-8"?>

<Package
    xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
    xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
    xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
    xmlns:desktop="http://schemas.microsoft.com/appx/manifest/desktop/windows10"
    xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
    xmlns:uap11="http://schemas.microsoft.com/appx/manifest/uap/windows10/11"
    xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
    IgnorableNamespaces="uap uap3 desktop uap10 uap11">

  <Identity
      Name="${escapeXml(config.identityName)}"
      Publisher="${escapeXml(config.publisher)}"
      Version="${escapeXml(config.version)}"
      ProcessorArchitecture="x64" />

  <Properties>
    <DisplayName>${escapeXml(config.displayName)}</DisplayName>
    <PublisherDisplayName>${escapeXml(config.publisherDisplayName)}</PublisherDisplayName>
    <Description>${escapeXml(config.description)}</Description>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>

  <Resources>
    <Resource Language="en-us" />
  </Resources>

  <Dependencies>
    <TargetDeviceFamily
        Name="Windows.Desktop"
        MinVersion="10.0.17763.0"
        MaxVersionTested="10.0.26100.0" />
  </Dependencies>

  <Applications>

    <Application
        Id="App"
        Executable="${escapeXml(config.executable)}"
        EntryPoint="Windows.FullTrustApplication">

      <uap:VisualElements
          DisplayName="${escapeXml(config.displayName)}"
          Description="${escapeXml(config.description)}"
          BackgroundColor="#FFFFFF"
          Square150x150Logo="Assets\\StoreLogo.png"
          Square44x44Logo="Assets\\StoreLogo.png" />

      <!-- Fixed Container: The root block must be the base namespace <Extensions> -->
      <Extensions>
        <uap3:Extension
            Category="windows.appExecutionAlias"
            Executable="extensions\\dist\\server.exe"
          EntryPoint="Windows.FullTrustApplication"
            uap11:Subsystem="console">
          <uap3:AppExecutionAlias>
            <desktop:ExecutionAlias Alias="figgo-todo-server.exe" />
          </uap3:AppExecutionAlias>
        </uap3:Extension>
      </Extensions>

    </Application>

  </Applications>

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>

</Package>
`;
  writeFileSync(manifestPath, xml, "utf8");
  console.log(`Wrote ${manifestPath}`);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function findSdkTool(toolName) {
  const roots = [
    join(
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
      "Windows Kits",
      "10",
      "bin",
    ),
    join(
      process.env.ProgramFiles || "C:\\Program Files",
      "Windows Kits",
      "10",
      "bin",
    ),
  ];

  const found = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const versionDir of readdirSync(root)) {
      const candidate = join(root, versionDir, "x64", toolName);
      if (existsSync(candidate)) {
        found.push({ versionDir, candidate });
      }
    }
  }

  found.sort((a, b) =>
    b.versionDir.localeCompare(a.versionDir, undefined, { numeric: true }),
  );
  return found[0]?.candidate ?? null;
}

function packMsix(makeAppxPath, inputDir, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  if (existsSync(outputPath)) {
    rmSync(outputPath, { force: true });
  }

  const result = spawnSync(
    makeAppxPath,
    ["pack", "/d", inputDir, "/p", outputPath, "/o"],
    { stdio: "inherit", shell: false },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`MakeAppx failed with exit code ${result.status}`);
  }
}

function signMsix(signToolPath, msixPath, certificatePath, password) {
  if (!existsSync(certificatePath)) {
    throw new Error(`Certificate not found: ${certificatePath}`);
  }

  const args = ["sign", "/fd", "SHA256", "/a", "/f", certificatePath];

  if (password) {
    args.push("/p", password);
  }

  args.push(msixPath);

  const result = spawnSync(signToolPath, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`SignTool failed with exit code ${result.status}`);
  }
}
