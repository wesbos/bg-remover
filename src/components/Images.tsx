import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function Images() {
  const images = useLiveQuery(() => db.images.reverse().toArray());

  return (
    <div>
      <div className="gap-2 grid grid-cols-4">
        {images?.map((image) => (
          <Image image={image} />
        ))}
      </div>
    </div>
  );
}

function Image({ image }: { image: Image }) {
  const imageProcessed = image.processedFile instanceof File;
  return (
    <div key={image.id} className="grid gap-2">
      <img
        className="rounded-lg h w-full aspect-square object-cover col-start-1 row-start-1"
        src={URL.createObjectURL(image.file)}
        alt={image.name}
      />
      <img
        className={`rounded-lg h w-full bg-checkered aspect-square object-cover col-start-1 row-start-1 mask ${imageProcessed ? "" : "processing"}`}
        src={imageProcessed ? URL.createObjectURL(image.processedFile) : ""}
      />
    </div>
  );
}
