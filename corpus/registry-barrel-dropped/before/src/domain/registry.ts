export interface RegistryEntry {
  readonly key: string;
  readonly version: number;
}

export class Registry {
  private readonly entries = new Map<string, RegistryEntry>();

  register(entry: RegistryEntry): void {
    this.entries.set(entry.key, entry);
  }

  lookup(key: string): RegistryEntry | undefined {
    return this.entries.get(key);
  }
}
