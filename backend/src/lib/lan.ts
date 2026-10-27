import os from "node:os";

export function lanUrls(port: number) {
  const urls: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      const family = String(item.family);
      if ((family === "IPv4" || family === "4") && !item.internal) {
        urls.push(`http://${item.address}:${port}`);
      }
    }
  }
  return urls;
}
