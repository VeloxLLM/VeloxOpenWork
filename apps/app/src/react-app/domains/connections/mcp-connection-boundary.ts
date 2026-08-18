import { getMcpServerName, type McpDirectoryInfo } from "../../../app/constants";

export function conflictsWithOpenworkConnect(
  entry: Pick<McpDirectoryInfo, "id" | "name" | "serverName">,
): boolean {
  const serverName = entry.id ?? getMcpServerName({
    ...entry,
    description: "",
    oauth: false,
  });
  // This legacy reserved name belonged to the removed Cloud MCP. Keeping it
  // unavailable prevents an old Cloud configuration from being recreated.
  return serverName === "openwork-cloud";
}
