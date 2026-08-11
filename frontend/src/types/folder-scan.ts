export type FolderScanImport = { file: string; year: number };

export type FolderScanFailure = {
  file: string;
  /** O ano que o ficheiro reclamava, quando se chegou a saber. */
  year: number | null;
  reason: string;
};

export type FolderScanResult = {
  imported: FolderScanImport[];
  failed: FolderScanFailure[];
};

export type FolderScanResponse =
  | { status: "not-configured" }
  | { status: "unauthenticated" }
  | ({ status: "done"; fromCache: boolean } & FolderScanResult);
