import os from "node:os";

function usableLanAddress(address: string) {
  if (!address || address.startsWith("127.")) return false;
  // 169.254.x.x is a temporary Windows address. It appears when the cable
  // has no real IP yet, and the second PC cannot use it.
  if (address.startsWith("169.254.")) return false;
  return true;
}

export function lanUrls(port: number) {
  const urls: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      const family = String(item.family);
      if ((family === "IPv4" || family === "4") && !item.internal && usableLanAddress(item.address)) {
        urls.push(`http://${item.address}:${port}`);
      }
    }
  }
  urls.sort((a, b) => {
    const aMain = a.includes("192.168.0.1") ? 0 : 1;
    const bMain = b.includes("192.168.0.1") ? 0 : 1;
    return aMain - bMain;
  });
  return urls;
}
