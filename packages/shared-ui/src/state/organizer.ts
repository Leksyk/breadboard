/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetMetadata, AssetPath, NodeValue } from "@breadboard-ai/types";
import { Outcome } from "@google-labs/breadboard";
import { GraphAsset, Organizer, ProjectInternal } from "./types";
import { RemoveAssetWithRefs } from "../transforms";
import { UpdateAssetWithRefs } from "../transforms/update-asset-with-refs";

export { ReactiveOrganizer };

class ReactiveOrganizer implements Organizer {
  #project: ProjectInternal;
  readonly graphAssets: Map<AssetPath, GraphAsset>;
  readonly graphUrl: URL | null;

  constructor(project: ProjectInternal) {
    this.#project = project;
    this.graphAssets = project.graphAssets;
    this.graphUrl = project.graphUrl;
  }

  async addGraphAsset(asset: GraphAsset): Promise<Outcome<void>> {
    const { data: assetData, metadata, path } = asset;
    const data = (await this.#project.persistBlobs(assetData)) as NodeValue;
    return this.#project.edit(
      [{ type: "addasset", path, data, metadata }],
      `Adding asset at path "${path}"`
    );
  }

  removeGraphAsset(path: AssetPath): Promise<Outcome<void>> {
    return this.#project.apply(new RemoveAssetWithRefs(path));
  }

  changeGraphAssetMetadata(
    path: AssetPath,
    metadata: AssetMetadata
  ): Promise<Outcome<void>> {
    return this.#project.apply(new UpdateAssetWithRefs(path, metadata));
  }
}
