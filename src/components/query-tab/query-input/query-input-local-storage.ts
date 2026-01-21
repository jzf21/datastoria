import { appLocalStorage } from "@/lib/local-storage";

const queryStorage = appLocalStorage.subStorage("query");

export class QueryInputLocalStorage {
  public static getInput(key: string): string {
    const value = queryStorage.getChildAsString(key);
    return value || "";
  }

  public static saveInput(text: string, key: string): void {
    queryStorage.setChildAsString(key, text);
  }
}
