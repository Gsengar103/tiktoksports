function loadVideo(uri: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = uri;
    video.onerror = () => reject(new Error("Could not read a frame from this video"));
    video.onloadeddata = () => resolve(video);
  });
}

function jpegUrl(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(1, Math.round((sourceHeight / Math.max(sourceWidth, 1)) * width));
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("Could not draw a thumbnail"));
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not encode the thumbnail"));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/jpeg", 0.85);
  });
}

export async function makeThumbnails(uri: string): Promise<{ smallUri: string; largeUri: string }> {
  const video = await loadVideo(uri);
  const largeUri = await jpegUrl(video, video.videoWidth, video.videoHeight, 540);
  const smallUri = await jpegUrl(video, video.videoWidth, video.videoHeight, 270);
  return { smallUri, largeUri };
}
