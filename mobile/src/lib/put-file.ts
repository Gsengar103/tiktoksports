import { File } from "expo-file-system";

export async function putFile(uri: string, url: string, contentType: string): Promise<void> {
  const result = await new File(uri).upload(url, {
    httpMethod: "PUT",
    headers: { "Content-Type": contentType },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status})`);
  }
}
