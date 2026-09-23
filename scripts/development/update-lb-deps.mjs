#!/usr/bin/env node
import { runCLI } from "./mfw/cli.mjs";

await runCLI({ ocr: true });
