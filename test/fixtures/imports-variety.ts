import express from 'express';
import { Router, Request, Response } from 'express';
import * as path from 'path';
import { readFile as read, writeFile } from 'fs/promises';
import type { Server } from 'http';
import { type IncomingMessage, ServerResponse } from 'http';

const app = express();
const router = Router();

function handleRequest(req: Request, res: Response): void {
  const filePath = path.join(__dirname, 'index.html');
  read(filePath, 'utf-8').then(content => {
    res.send(content);
  });
}

function writeLogs(data: string): void {
  const logPath = path.resolve('logs', 'app.log');
  writeFile(logPath, data);
}
