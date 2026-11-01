// A stand-in for expo-file-system's File, Directory and Paths, for `vi.mock('expo-file-system', …)`:
// each test says what its device holds and records what the code does through these hooks. A
// directory's uri ends in a slash, as the app builds them.
type Hooks = {
  document?: string;
  cache?: string;
  exists?(uri: string): boolean;
  delete?(uri: string): void;
  list?(uri: string): string[];
  create?(uri: string): void;
  move?(from: string, to: string): void | Promise<void>;
  copy?(from: string, to: string): void | Promise<void>;
  info?(uri: string): { exists: boolean; modificationTime?: number | null };
  download?(url: string, uri: string, options?: { signal?: AbortSignal }): void | Promise<void>;
};

type Part = string | { uri: string };

export function fakeFileSystem(hooks: Hooks) {
  class Entry {
    uri: string;
    constructor(...parts: Part[]) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : part.uri))
        .reduce((path, part) => (path.endsWith('/') ? path + part : `${path}/${part}`));
    }
    get name() {
      return this.uri.replace(/\/$/, '').split('/').pop()!;
    }
    get exists() {
      return hooks.exists?.(this.uri) ?? false;
    }
    delete() {
      if (!this.exists) throw new Error(`${this.uri} does not exist`);
      hooks.delete?.(this.uri);
    }
    info() {
      return hooks.info?.(this.uri) ?? { exists: this.exists };
    }
  }

  class File extends Entry {
    async move(destination: { uri: string }) {
      await hooks.move?.(this.uri, destination.uri);
      this.uri = destination.uri;
    }
    async copy(destination: { uri: string }) {
      await hooks.copy?.(this.uri, destination.uri);
    }
    static async downloadFileAsync(url: string, destination: { uri: string }, options?: { signal?: AbortSignal }) {
      await hooks.download?.(url, destination.uri, options);
      return new File(destination.uri);
    }
  }

  class Directory extends Entry {
    constructor(...parts: Part[]) {
      super(...parts);
      if (!this.uri.endsWith('/')) this.uri += '/';
    }
    create() {
      hooks.create?.(this.uri);
    }
    list() {
      return (hooks.list?.(this.uri) ?? []).map((name) => new File(this.uri, name));
    }
  }

  const Paths = {
    get document() {
      return new Directory(hooks.document ?? 'file:///documents/');
    },
    get cache() {
      return new Directory(hooks.cache ?? 'file:///caches/');
    },
  };

  return { File, Directory, Paths, UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 } };
}
