import {
  env,
  AutoModel,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";
import { db } from '../src/db';

const model_id = "Xenova/modnet";
env.backends.onnx.wasm.proxy = false;

const model = await AutoModel.from_pretrained(model_id, {
  device: "webgpu",
});
const processor = await AutoProcessor.from_pretrained(model_id);

export async function processImage(image: File): Promise<File> {
  const img = await RawImage.fromURL(URL.createObjectURL(image));
  // Pre-process image
  const { pixel_values } = await processor(img);
  // Predict alpha matte
  const { output } = await model({ input: pixel_values });


  const maskData = (
    await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
      img.width,
      img.height,
    )
  ).data;

  // Create new canvas
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if(!ctx) throw new Error("Could not get 2d context");
  // Draw original image output to canvas
  ctx.drawImage(img.toCanvas(), 0, 0);

  // Update alpha channel
  const pixelData = ctx.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < maskData.length; ++i) {
    pixelData.data[4 * i + 3] = maskData[i];
  }
  ctx.putImageData(pixelData, 0, 0);
  // Convert canvas to blob
  const blob = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(), "image/png"));
  const processedFile = new File([blob], image.name, { type: "image/png" });
  return processedFile;
}

export async function processImages() {
  console.log("Processing images...");
  // Query images that need to be processed
  const imagesToProcess = db.images.where("processedFile").equals('null').reverse();
  console.log("imagesToProcess", await imagesToProcess.toArray());
  for (const image of await imagesToProcess.toArray()) {
    console.log("Processing image", image.id);
    const file = await processImage(image.file);
    await db.images.update(image.id, { processedFile: file });
  }
  console.log("Processing images done");
};
