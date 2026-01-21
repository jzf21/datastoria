class LocalStorage {
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  // Helper to check if localStorage is available (client-side only)
  private isAvailable(): boolean {
    return typeof window !== "undefined" && typeof localStorage !== "undefined";
  }

  public getAsJSON<T>(defaultValueFactory: () => T): T {
    if (!this.isAvailable()) {
      return defaultValueFactory();
    }
    try {
      const value = localStorage.getItem(this.key);
      if (value === null) {
        return defaultValueFactory();
      }
      return JSON.parse(value);
    } catch {
      return defaultValueFactory();
    }
  }

  public setJSON(value: unknown): void {
    if (!this.isAvailable()) return;
    localStorage.setItem(this.key, JSON.stringify(value));
  }

  /**
   * Get a child key's value as JSON without creating a subStorage object
   */
  public getChildAsJSON<T>(childKey: string, defaultValueFactory: () => T): T {
    if (!this.isAvailable()) {
      return defaultValueFactory();
    }
    try {
      const value = localStorage.getItem(`${this.key}:${childKey}`);
      if (value === null) {
        return defaultValueFactory();
      }
      return JSON.parse(value);
    } catch {
      return defaultValueFactory();
    }
  }

  public getChildAsString(childKey: string): string | null {
    if (!this.isAvailable()) {
      return null;
    }
    return localStorage.getItem(`${this.key}:${childKey}`);
  }

  /**
   * Set a child key's value as JSON without creating a subStorage object
   */
  public setChildJSON(childKey: string, value: unknown): void {
    if (!this.isAvailable()) return;
    localStorage.setItem(`${this.key}:${childKey}`, JSON.stringify(value));
  }

  public setChildAsString(childKey: string, value: string): void {
    if (!this.isAvailable()) return;
    localStorage.setItem(`${this.key}:${childKey}`, value);
  }

  /**
   * Remove a child key without creating a subStorage object
   */
  public removeChild(childKey: string): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(`${this.key}:${childKey}`);
  }

  public getString(): string | null {
    if (!this.isAvailable()) return null;
    return localStorage.getItem(this.key);
  }

  public setString(value: string): void {
    if (!this.isAvailable()) return;
    localStorage.setItem(this.key, value);
  }

  public getObject(): unknown {
    if (!this.isAvailable()) return null;
    try {
      const value = localStorage.getItem(this.key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  public remove(): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(this.key);
  }

  /**
   * Get the number of items in localStorage that start with this key as prefix
   */
  public get length(): number {
    if (!this.isAvailable()) return 0;
    const prefix = this.key + ":";
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all sub-keys that start with this key as prefix (returns keys without the prefix)
   */
  public keys(): string[] {
    if (!this.isAvailable()) return [];
    const prefix = this.key + ":";
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        result.push(key.slice(prefix.length));
      }
    }
    return result;
  }

  /**
   * Remove all items that start with this key as prefix
   */
  public clear(): void {
    if (!this.isAvailable()) return;
    const prefix = this.key + ":";
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }

  /**
   * Create a sub-storage with a nested key
   */
  public subStorage(subKey: string): LocalStorage {
    return new LocalStorage(`${this.key}:${subKey}`);
  }
}

// Default instance with 'datastoria' prefix for the application
const appLocalStorage = new LocalStorage("datastoria");

export { LocalStorage, appLocalStorage };
