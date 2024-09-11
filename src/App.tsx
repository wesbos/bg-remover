import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  env,
  AutoModel,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { db } from './db';
import { Images } from "./components/Images";
import { processImages } from "../lib/process";
// import "onnxruntime-web/webgpu";
 import "onnxruntime-web";

export default function App() {
  const [images, setImages] = useState([]);

  const [processedImages, setProcessedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const modelRef = useRef(null);
  const processorRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        if (!navigator.gpu) {
          console.log("WebGPU is not supported in this browser.");
          throw new Error("WebGPU is not supported in this browser.");
        }
        const model_id = "Xenova/modnet";
        env.backends.onnx.wasm.proxy = false;
        modelRef.current ??= await AutoModel.from_pretrained(model_id, {
          device: "webgpu",
        });
        processorRef.current ??= await AutoProcessor.from_pretrained(model_id);
        //  Fetch images from IndexedDB
        // const images = await db.images.toArray();
        // setImages(images.map((image) => URL.createObjectURL(image.file)));
      } catch (err) {
        setError(err);
      }
      setIsLoading(false);
    })();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const id = await db.images.add({ file, processedFile: "null" });
      console.log(`Added image with id ${id}`);
    }
    // Trigger image processing
    await processImages();
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".mp4"],
    },
  });


  const downloadAsZip = async () => {
    const zip = new JSZip();
    const images = (await db.images.toArray()).map((image) => image.processedFile);
    for(const image of images){
      zip.file(image.name, image);
    }
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `background-blasted.zip`);
  };

  const clearAll = () => {
    setImages([]);
    setProcessedImages([]);
    setIsDownloadReady(false);
    db.images.where("id").above(0).delete();
  };

  const copyToClipboard = async (url) => {
    try {
      // Fetch the image from the URL and convert it to a Blob
      const response = await fetch(url);
      const blob = await response.blob();

      // Create a clipboard item with the image blob
      const clipboardItem = new ClipboardItem({ [blob.type]: blob });

      // Write the clipboard item to the clipboard
      await navigator.clipboard.write([clipboardItem]);

      console.log("Image copied to clipboard");
    } catch (err) {
      console.error("Failed to copy image: ", err);
    }
  };

  const downloadImage = (url) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl mb-2">ERROR</h2>
          <p className="text-xl max-w-[500px]">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-4"></div>
          <p className="text-lg">Loading background removal model...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">
          Remove Background WebGPU
        </h1>

        <h2 className="text-lg font-semibold mb-2 text-center">
          In-browser background removal, powered by{" "}
          <a
            className="underline"
            target="_blank"
            href="https://github.com/xenova/transformers.js"
          >
            🤗 Transformers.js
          </a>
        </h2>
        <div className="flex justify-center mb-8 gap-8">
          <a
            className="underline"
            target="_blank"
            href="https://github.com/huggingface/transformers.js-examples/blob/main/LICENSE"
          >
            License (Apache 2.0)
          </a>
          <a
            className="underline"
            target="_blank"
            href="https://huggingface.co/Xenova/modnet"
          >
            Model (MODNet)
          </a>
          <a
            className="underline"
            target="_blank"
            href="https://github.com/huggingface/transformers.js-examples/tree/main/remove-background-webgpu/"
          >
            Code (GitHub)
          </a>
        </div>
        <div
          {...getRootProps()}
          className={`p-8 mb-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-300 ease-in-out
            ${isDragAccept ? "border-green-500 bg-green-900/20" : ""}
            ${isDragReject ? "border-red-500 bg-red-900/20" : ""}
            ${isDragActive ? "border-blue-500 bg-blue-900/20" : "border-gray-700 hover:border-blue-500 hover:bg-blue-900/10"}
          `}
        >
          <input {...getInputProps()} className="hidden" />
          <p className="text-lg mb-2">
            {isDragActive
              ? "Drop the images here..."
              : "Drag and drop some images here"}
          </p>
          <p className="text-sm text-gray-400">or click to select files</p>
        </div>
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex gap-4">
            <button
              onClick={downloadAsZip}
              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-black disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors duration-200 text-sm"
            >
              Download as ZIP
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black transition-colors duration-200 text-sm"
            >
              Clear All
            </button>
          </div>
        </div>

        <Images/>
        {/* Old */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((src, index) => (
            <div key={index} className="relative group">
              <img
                src={processedImages[index] || src}
                alt={`Image ${index + 1}`}
                className="rounded-lg object-cover w-full h-48"
              />
              {processedImages[index] && (
                <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center">
                  <button
                    onClick={() =>
                      copyToClipboard(processedImages[index] || src)
                    }
                    className="mx-2 px-3 py-1 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors duration-200 text-sm"
                    aria-label={`Copy image ${index + 1} to clipboard`}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => downloadImage(processedImages[index] || src)}
                    className="mx-2 px-3 py-1 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors duration-200 text-sm"
                    aria-label={`Download image ${index + 1}`}
                  >
                    Download
                  </button>
                </div>
              )}

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
