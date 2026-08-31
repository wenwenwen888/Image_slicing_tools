import { ACCEPTED_IMAGE_TYPES } from "./constants";

export function getMimeTypeFromFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "image/png";
}

export function isAcceptedImageFile(file: File) {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return true;
  }

  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

export async function blobUrlToDataUrl(url: string) {
  const blob = await fetch(url).then((response) => response.blob());
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Project image serialization failed"));
    };
    reader.onerror = () => reject(new Error("Project image serialization failed"));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string) {
  const [meta, data] = dataUrl.split(",");
  const base64 = meta.includes(";base64");
  const binaryString = base64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}
