/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { ok } from "@google-labs/breadboard";

import { authenticateAndGetUserStore } from "../auth.js";
import { getBody } from "../common.js";
import { getStore } from "../store.js";
import type { BoardServerStore } from "../types.js";

async function updateInvite(req: Request, res: Response): Promise<void> {
  let { fullPath } = res.locals.boardId;
  let store: BoardServerStore | undefined = undefined;

  const userStore = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userStore)) {
    return;
  }
  if (!store) {
    store = getStore();
  }

  const body = await getBody(req);
  if (!body) {
    // create new invite
    const result = await store.createInvite(userStore, fullPath);
    let responseBody;
    if (!result.success) {
      responseBody = { error: result.error };
    } else {
      responseBody = { invite: result.invite };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responseBody));
    return;
  } else {
    // delete invite
    const del = body as { delete: string };
    if (!del.delete) {
      return;
    }
    const result = await store.deleteInvite(userStore, fullPath, del.delete);
    let responseBody;
    if (!result.success) {
      // TODO: Be nice and return a proper error code
      responseBody = { error: result.error };
    } else {
      responseBody = { deleted: del.delete };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responseBody));
  }
}

export default updateInvite;
