// db.ts
import Dexie, { type EntityTable } from 'dexie';

interface Image {
  id: number;
  file: File;
  processedFile?: File;
}

const db = new Dexie('BackgroundRemoverDb') as Dexie & {
  images: EntityTable<
    Image,
    'id' // primary key "id" (for the typings only)
  >;
};

// Schema declaration:
db.version(1).stores({
  images: '++id, file, processedFile' // primary key "id" (for the runtime!)
});


export type { Image };
export { db };
