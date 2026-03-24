/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {glob} from 'glob';
import {access, unlink} from 'node:fs/promises';
import path from 'node:path';

const FFMPEG_PATTERNS = [
  '**/libffmpeg.so*',
  '**/ffmpeg.dll',
  '**/libffmpeg.dylib',
  '**/ffmpeg.dll',
];

async function removeFile(file: string): Promise<void> {
  try {
    await access(file);
    await unlink(file);
    console.log(`✅ Removed: ${file}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage !== 'ENOENT') {
      console.warn(`⚠️  Could not remove ${file}: ${errorMessage}`);
    }
  }
}

async function removeFilesInDirectory(
  matchDir: string,
  pattern: string,
): Promise<void> {
  const ffmpegFiles = await glob(path.join(matchDir, pattern));
  await Promise.all(ffmpegFiles.map((file) => removeFile(file)));
}

async function processDirectory(dir: string): Promise<void> {
  try {
    const matches = await glob(dir, {ignore: ['node_modules/**']});

    for (const matchDir of matches) {
      await Promise.all(
        FFMPEG_PATTERNS.map((pattern) =>
          removeFilesInDirectory(matchDir, pattern),
        ),
      );
    }
  } catch {
    // Directory doesn't exist, skip
  }
}

export async function removeBinaries() {
  console.log('🔍 Scanning for FFmpeg libraries to remove...');

  const directories = [
    'out/win-unpacked',
    'out/linux-unpacked',
    'out/mac-unpacked',
    'dist',
  ];

  await Promise.all(directories.map((dir) => processDirectory(dir)));

  console.log('✅ FFmpeg library removal completed');
}
