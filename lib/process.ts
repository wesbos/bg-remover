import {
  env,
  AutoModel,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";
import { db } from '../src/db';
import * as Mp4Muxer from "mp4-muxer";

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
  const [fileName, fileExtension] = image.name.split(".");
  const processedFile = new File([blob], `${fileName}-bg-blasted.png`, { type: "image/png" });
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



// export async function processVideo() {

//   async function run() {
//     const canvas = new OffscreenCanvas(720, 1280);
//     const ctx = canvas.getContext("2d", {
//       // This forces the use of a software (instead of hardware accelerated) 2D canvas
//       // This isn't necessary, but produces quicker results
//       willReadFrequently: true,
//       // Desynchronizes the canvas paint cycle from the event loop
//       // Should be less necessary with OffscreenCanvas, but with a real canvas you will want this
//       desynchronized: true,
//     });

//     const fps = 30;
//     const duration = 60;
//     const numFrames = duration * fps;

//     let muxer = new Mp4Muxer.Muxer({
//       target: new Mp4Muxer.ArrayBufferTarget(),

//       video: {
//         // If you change this, make sure to change the VideoEncoder codec as well
//         codec: "avc",
//         width: canvas.width,
//         height: canvas.height,
//       },

//       // mp4-muxer docs claim you should always use this with ArrayBufferTarget
//       fastStart: "in-memory",
//     });

//     let videoEncoder = new VideoEncoder({
//       output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
//       error: (e) => console.error(e),
//     });

//     // This codec should work in most browsers
//     // See https://dmnsgn.github.io/media-codecs for list of codecs and see if your browser supports
//     videoEncoder.configure({
//       codec: "avc1.42001f",
//       width: canvas.width,
//       height: canvas.height,
//       bitrate: 500_000,
//       bitrateMode: "constant",
//     });

//     // Loops through and draws each frame to the canvas then encodes it
//     for (let frameNumber = 0; frameNumber < numFrames; frameNumber++) {
//       drawFrameToCanvas({
//         ctx,
//         canvas,
//         frameNumber,
//         numFrames
//       });
//       renderCanvasToVideoFrameAndEncode({
//         canvas,
//         videoEncoder,
//         frameNumber,
//         fps
//       })
//     }

//     // Forces all pending encodes to complete
//     await videoEncoder.flush();

//     muxer.finalize();

//     let buffer = muxer.target.buffer;
//     downloadBlob(new Blob([buffer]));
//   }
// }
