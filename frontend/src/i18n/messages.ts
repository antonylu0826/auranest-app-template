import type { Locale } from "./config";
import en from "../../messages/en.json";
import zhTW from "../../messages/zh-TW.json";

export const allMessages: Record<Locale, Record<string, unknown>> = {
  "zh-TW": zhTW,
  en,
};
