/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { AddAssetEvent, OverlayDismissedEvent } from "../../../events/events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { InlineDataCapabilityPart, LLMContent } from "@breadboard-ai/types";

@customElement("bb-add-asset-modal")
export class AddAssetModal extends LitElement {
  @property()
  accessor assetType: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 100;
      pointer-events: none;
    }

    #container {
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      width: 100%;
      height: 100%;
      background: oklch(
        from var(--background-color, var(--bb-neutral-900)) l c h /
          calc(alpha - 0.6)
      );
    }

    #content {
      background: var(--background-color, var(--bb-neutral-0));
      border: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-3);
      border-radius: var(--bb-grid-size-3);
      display: flex;
      flex-direction: column;
      width: min-content;
      height: min-content;
      max-width: 640px;
      max-height: 640px;

      & h1 {
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        color: var(--text-color, var(--bb-neutral-900));
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      & input[type="text"],
      & input[type="url"],
      & input[type="number"],
      & textarea,
      & select {
        display: block;
        width: 100%;
        min-width: 320px;
        border-radius: var(--bb-grid-size);
        background: var(--background-color, var(--bb-neutral-0));
        color: var(--text-color, var(--bb-neutral-900));
        padding: var(--bb-grid-size-2);
        border: 1px solid var(--bb-neutral-300);
        resize: none;
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
      }

      textarea {
        field-sizing: content;
      }

      & button {
        display: block;
        background: var(--primary-color, var(--bb-neutral-100));
        color: var(--primary-text-color, var(--bb-neutral-700));
        border-radius: var(--bb-grid-size-16);
        border: none;
        opacity: 0.75;
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        height: var(--bb-grid-size-7);
        margin-top: var(--bb-grid-size-2);
        padding: 0 var(--bb-grid-size-3);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }
    }
  `;

  #containerRef: Ref<HTMLDivElement> = createRef();

  async #processAndEmit() {
    if (!this.#containerRef.value) {
      return;
    }

    const inputs = this.#containerRef.value.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input,select,textarea");

    let canSubmit = true;
    let item: LLMContent | null = null;
    for (const input of inputs) {
      if (!input.checkValidity()) {
        input.reportValidity();
        canSubmit = false;
        continue;
      }

      switch (this.assetType) {
        case "youtube": {
          item = {
            role: "user",
            parts: [
              { fileData: { fileUri: input.value, mimeType: "video/mp4" } },
            ],
          };
          break;
        }

        case "upload": {
          if (!(input instanceof HTMLInputElement)) {
            break;
          }

          if (!input.files) {
            break;
          }

          const fileData: Promise<InlineDataCapabilityPart>[] = [
            ...input.files,
          ].map((file) => {
            return new Promise((resolve, reject) => {
              const fileReader = new FileReader();
              fileReader.onloadend = () => {
                const premable = `data:${file.type};base64,`.length;
                const data = (fileReader.result as string).slice(premable);
                resolve({
                  inlineData: {
                    data,
                    mimeType: file.type,
                  },
                });
              };

              fileReader.onerror = () => reject();
              fileReader.readAsDataURL(file);
            });
          });

          const parts = await Promise.all(fileData);
          item = {
            role: "user",
            parts,
          };

          break;
        }
      }
    }

    if (!canSubmit || !item) {
      return;
    }

    this.dispatchEvent(new AddAssetEvent(item));
  }

  render() {
    if (!this.assetType) {
      return nothing;
    }

    let title: HTMLTemplateResult | symbol = nothing;
    let assetCollector: HTMLTemplateResult | symbol = nothing;
    switch (this.assetType) {
      case "youtube":
        title = html`Add YouTube Video`;
        assetCollector = html`<input
          type="url"
          placeholder="https://www.youtube.com/watch?v=<video>"
          pattern="^https://www.youtube.com/(watch|embed).*"
        />`;
        break;

      case "upload":
        title = html`Upload from Device`;
        assetCollector = html`<input type="file" required />`;
        break;

      default:
        assetCollector = html`Unknown asset type`;
        break;
    }

    return html`<div
      id="container"
      ${ref(this.#containerRef)}
      @pointerdown=${() => {
        this.dispatchEvent(new OverlayDismissedEvent());
      }}
    >
      <div
        id="content"
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
        @keydown=${(evt: KeyboardEvent) => {
          const isMac = navigator.platform.indexOf("Mac") === 0;
          const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

          if (!(evt.key === "Enter" && isCtrlCommand)) {
            return;
          }

          this.#processAndEmit();
        }}
      >
        <h1>${title}</h1>
        ${assetCollector}
        <div>
          <button
            @click=${() => {
              this.#processAndEmit();
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>`;
  }
}
