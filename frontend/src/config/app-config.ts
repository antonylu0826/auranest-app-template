import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

// ⚠️  Fork 後請修改以下所有欄位
export const APP_CONFIG = {
  name: "AuraNest Calendar",
  version: packageJson.version,
  copyright: `© ${currentYear}, AuraNest Calendar.`,
  meta: {
    title: "AuraNest Calendar",
    description: "Google Calendar-like scheduling app powered by AuraNest.",
  },
};
