import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

// ⚠️  Fork 後請修改以下所有欄位
export const APP_CONFIG = {
  name: "AuraNest App",
  version: packageJson.version,
  copyright: `© ${currentYear}, AuraNest App.`,
  meta: {
    title: "AuraNest App",
    description: "Powered by AuraNest.",
  },
};
