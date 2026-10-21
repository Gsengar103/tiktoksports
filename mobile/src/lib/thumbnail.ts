import * as VideoThumbnails from "expo-video-thumbnails";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export async function makeThumbnails(uri: string): Promise<{ smallUri: string; largeUri: string }> {
  const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: 0 });
  const small = await manipulateAsync(thumb.uri, [{ resize: { width: 270 } }], { format: SaveFormat.JPEG, compress: 0.8 });
  const large = await manipulateAsync(thumb.uri, [{ resize: { width: 540 } }], { format: SaveFormat.JPEG, compress: 0.8 });
  return { smallUri: small.uri, largeUri: large.uri };
}
