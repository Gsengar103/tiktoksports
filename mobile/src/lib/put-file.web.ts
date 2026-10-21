export async function putFile(uri: string, url: string, contentType: string): Promise<void> {
  const file = await fetch(uri);
  if (!file.ok) throw new Error("Could not read the file to upload");
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: await file.blob(),
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
}
