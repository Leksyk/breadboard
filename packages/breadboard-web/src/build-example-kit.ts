/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  defineNodeType,
  type Value,
  type NodeFactoryFromDefinition,
} from "@breadboard-ai/build";
import { addKit } from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";

export const reverseString = defineNodeType({
  name: "reverseString",
  inputs: {
    forwards: {
      type: "string",
      description: "The string to reverse",
    },
  },
  outputs: {
    backwards: {
      type: "string",
      description: "The reversed string",
      primary: true,
    },
  },
  invoke: ({ forwards }) => {
    return {
      backwards: forwards.split("").reverse().join(""),
    };
  },
});

export const templater = defineNodeType({
  name: "templater",
  inputs: {
    template: {
      type: "string",
      description: "A template with {{placeholders}}.",
    },
    "*": {
      type: "string",
      description: "Values to fill into template's {{placeholders}}.",
    },
  },
  outputs: {
    result: {
      type: "string",
      description: "The template with {{placeholders}} substituted.",
      primary: true,
    },
  },
  describe: ({ template }) => ({
    inputs: extractPlaceholders(template ?? ""),
  }),
  invoke: ({ template }, placeholders) => ({
    result: substituteTemplatePlaceholders(template, placeholders),
  }),
});

function extractPlaceholders(template: string): string[] {
  const matches = template.matchAll(/{{(?<name>[\w-]+)}}/g);
  const parameters = Array.from(matches).map(
    (match) => match.groups?.name || ""
  );
  const unique = Array.from(new Set(parameters));
  return unique;
}

function substituteTemplatePlaceholders(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, String(value)),
    template
  );
}

/**
 * An example of a sugar function which wraps instantiation of a node (in this
 * case, a template), in a more convenient syntax (in this case, a tagged
 * template literal function).
 */
export function prompt(
  strings: TemplateStringsArray,
  ...values: Value<string>[]
) {
  let template = "";
  const placeholders: Record<string, Value<string>> = {};
  for (let i = 0; i < strings.length; i++) {
    if (i > 0) {
      template += "}}";
    }
    template += strings[i];
    if (i < strings.length - 1) {
      template += `{{`;
      const name = `p${i}`;
      template += name;
      placeholders[name] = values[i]!;
    }
  }
  return templater({ template, ...placeholders });
}

const BuildExampleKit = new KitBuilder({
  title: "Example Kit",
  description: "An example kit",
  version: "0.1.0",
  url: "npm:@breadboard-ai/example-kit",
}).build({ reverseString, templater });
export default BuildExampleKit;

export const buildExampleKit = addKit(BuildExampleKit) as {
  reverseString: NodeFactoryFromDefinition<typeof reverseString>;
  templater: NodeFactoryFromDefinition<typeof templater>;
};
