/* eslint-disable no-console */
// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    if (isDev) console.debug(`[DEBUG] ${msg}`, ...args);
  },
  info: (msg: string, ...args: unknown[]) => {
    if (isDev) console.info(`[INFO] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    if (isDev) console.warn(`[WARN] ${msg}`, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    // Error luôn log (cả production) để debugging
    console.error(`[ERROR] ${msg}`, ...args);
  },
};
