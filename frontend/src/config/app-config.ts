import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

// ⚠️  Fork 後請修改以下所有欄位
export const APP_CONFIG = {
  name: "My App",           // 側邊欄標題、歡迎頁版本列
  version: packageJson.version,
  copyright: `© ${currentYear}, My App.`,
  meta: {
    title: "My App",        // HTML <title>
    description: "My App.", // HTML meta description
  },
};
