export type FileKind =
  | 'markdown'
  | 'text'
  | 'code'
  | 'pdf'
  | 'docx'
  | 'image'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'audio'
  | 'video'
  | 'unknown';

export type FileSource = 'picker' | 'share' | 'created' | 'vault' | 'recent';

export type AppFile = {
  id: string;
  name: string;
  uri: string;
  extension: string;
  mimeType?: string | null;
  size?: number | null;
  lastModified?: number | null;
  kind: FileKind;
  source: FileSource;
  openedAt: number;
  isEditable: boolean;
  isTextLike: boolean;
  textContent?: string;
  readError?: string;
};

export type RecentFile = Omit<AppFile, 'textContent' | 'readError'>;

export type VaultNote = {
  file: AppFile;
  title: string;
  links: string[];
  tags: string[];
  backlinks?: string[];
  preview: string;
};

export type AppScreen = 'home' | 'viewer' | 'convert' | 'settings' | 'vault';
