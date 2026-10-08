# Element Lens

Element Lens is a Chrome and Edge extension for selecting a visible page element and copying useful context for an AI agent.

## Current state

The Manifest V3 shell and one-shot hover picker are implemented. Click the toolbar action to enter pick mode, hover to see the target outline, then click an element to copy its AI-ready context. Press Escape to cancel.

## Load the extension locally

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Pin **Element Lens** from the browser’s extensions menu to keep its toolbar action visible.

To create a versioned unpacked folder and ZIP archive, run `.\scripts\package.ps1`. Extract the ZIP before choosing **Load unpacked**.

The browser will show the extension on ordinary web pages. Browser-internal and protected pages do not allow extensions to run.

## Capture scope

- The picker works in the top-level page. Hovering over an embedded frame selects the frame element; content inside the frame is not inspected.
- Open shadow-root content can be selected when the browser exposes it through the pointer event path. A closed shadow root is represented by its host.
- The bundle contains computed style values, not the page’s original CSS files or complete matching stylesheet rules.
- Browser-internal, extension-store, and other protected pages cannot be inspected. On those pages the toolbar action shows an unavailable indicator and explains that a regular webpage is required.
- Form values and attributes that look like credentials or secrets are redacted. Visible page text remains in the selected HTML and nearby context; review the bundle before sharing it.

The extension requests `activeTab`, `scripting`, and `clipboardWrite` so it can inject the picker and write to the clipboard after a user action. It does not request broad site access or transmit captured content.

## Product direction

The one-shot picker outlines the current target and copies the selected element’s HTML, useful computed styles, nearby DOM context, and available JavaScript clues. Form values are redacted. Captures remain local and limited to the selected element and nearby context.
