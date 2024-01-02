/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputStageResult, RunResult } from "./run.js";
import {
  GraphMetadata,
  InputValues,
  NodeHandlerContext,
  NodeValue,
  OutputValues,
  Schema,
  TraversalResult,
} from "./types.js";

export const createErrorMessage = (
  inputName: string,
  metadata: GraphMetadata = {},
  required: boolean
): string => {
  const boardTitle = metadata.title ?? metadata?.url;
  const requiredText = required ? "required " : "";
  return `Missing ${requiredText}input "${inputName}"${
    boardTitle ? ` for board "${boardTitle}".` : "."
  }`;
};

export const bubbleUpInputsIfNeeded = async (
  metadata: GraphMetadata,
  context: NodeHandlerContext,
  result: TraversalResult
): Promise<void> => {
  // If we have no way to bubble up inputs, we just return and not
  // enforce required inputs.
  if (!context.requestInput) return;

  const outputs = (await result.outputsPromise) ?? {};
  const reader = new InputSchemaReader(outputs, result.inputs);
  result.outputsPromise = reader.read(createBubbleHandler(metadata, context));
};

export const createBubbleHandler = (
  metadata: GraphMetadata,
  context: NodeHandlerContext
) => {
  return (async (name, schema, required) => {
    if (required) {
      throw new Error(createErrorMessage(name, metadata, required));
    }
    if (schema.default !== undefined) {
      if (schema.type !== "string") {
        return JSON.parse(schema.default);
      }
      return schema.default;
    }
    const value = await context.requestInput?.(name, schema);
    if (value === undefined) {
      throw new Error(createErrorMessage(name, metadata, required));
    }
    return value;
  }) satisfies InputSchemaHandler;
};

export type InputSchemaHandler = (
  name: string,
  schema: Schema,
  required: boolean
) => Promise<NodeValue>;

export class InputSchemaReader {
  #currentOutputs: OutputValues;
  #inputs: InputValues;

  constructor(currentOutputs: OutputValues, inputs: InputValues) {
    this.#currentOutputs = currentOutputs;
    this.#inputs = inputs;
  }

  async read(handler: InputSchemaHandler): Promise<OutputValues> {
    if (!("schema" in this.#inputs)) return this.#currentOutputs;

    const schema = this.#inputs.schema as Schema;

    if (!schema.properties) return this.#currentOutputs;

    const entries = Object.entries(schema.properties);

    const newOutputs: OutputValues = {};
    for (const [name, property] of entries) {
      if (name in this.#currentOutputs) {
        newOutputs[name] = this.#currentOutputs[name];
        continue;
      }
      const required = schema.required?.includes(name) ?? false;
      const value = await handler(name, property, required);
      newOutputs[name] = value;
    }

    return {
      ...this.#currentOutputs,
      ...newOutputs,
    };
  }
}

/**
 * Informs requestInput handler that the input should be treated as a secret.
 * This information propagates out to the environment, which may choose to
 * display the input differently or draw from different sources.
 */
const SECRET_SYMBOL = Symbol("secret");

export class RequestedInputsManager {
  #context: NodeHandlerContext;
  #cache: Map<string, NodeValue> = new Map();

  constructor(context: NodeHandlerContext) {
    this.#context = context;
  }

  createHandler(
    next: (result: RunResult) => Promise<void>,
    result: TraversalResult,
    isSecret: boolean
  ) {
    console.log("createHandler", isSecret);
    return async (name: string, schema: Schema, secret?: symbol) => {
      const cachedValue = this.#cache.get(name);
      if (cachedValue !== undefined) return cachedValue;
      const requestInputResult = {
        ...result,
        inputs: {
          schema: { type: "object", properties: { [name]: schema } },
        },
      };
      const treatAsSecret = secret === SECRET_SYMBOL || isSecret;
      console.log("requestInput", name, schema, isSecret, secret);
      await next(new InputStageResult(requestInputResult, -1, treatAsSecret));
      const outputs = await requestInputResult.outputsPromise;
      let value = outputs && outputs[name];
      if (value === undefined) {
        const symbol = treatAsSecret ? SECRET_SYMBOL : undefined;
        value = await this.#context.requestInput?.(name, schema, symbol);
      }
      this.#cache.set(name, value);
      return value;
    };
  }
}
