import { Controller, Get, Put, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { readMemoryObject, saveMemoryObject } from "./object-storage";

@Controller("dev/objects")
export class DevObjectsController {
  @Put()
  async put(@Query("key") key: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    if (!key || process.env.STORAGE !== "memory") {
      res.status(404).end();
      return;
    }
    const body = await readBody(req);
    const contentType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "application/octet-stream";
    saveMemoryObject(key, body, contentType);
    res.status(200).send();
  }

  @Get()
  get(@Query("key") key: string, @Res() res: Response): void {
    if (!key || process.env.STORAGE !== "memory") {
      res.status(404).end();
      return;
    }
    const object = readMemoryObject(key);
    if (!object) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", object.contentType);
    res.send(object.body);
  }
}

function readBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
