import { defineMcp } from "@lovable.dev/mcp-js";
import listServicesTool from "./tools/list-services";
import checkServiceAreaTool from "./tools/check-service-area";

export default defineMcp({
  name: "hero-tv-mounting-mcp",
  title: "Hero TV Mounting MCP",
  version: "0.1.0",
  instructions:
    "Tools for Hero TV Mounting. Use `list_services` to see available TV mounting and related services with pricing. Use `check_service_area` to verify whether a US ZIP code is covered.",
  tools: [listServicesTool, checkServiceAreaTool],
});
