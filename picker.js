(() => {
  const pickerKey = "__elementLensActivePicker";
  const selectionKey = "__elementLensSelectedElement";

  if (window[pickerKey]) {
    window[pickerKey].cancel();
    return;
  }

  let hoveredElement = null;
  let disposed = false;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "all:initial !important",
    "position:fixed !important",
    "inset:0 !important",
    "z-index:2147483647 !important",
    "pointer-events:none !important",
  ].join(";");

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    #outline {
      position: fixed;
      display: none;
      box-sizing: border-box;
      border: 2px solid #7457ff;
      border-radius: 3px;
      background: rgb(116 87 255 / 12%);
      box-shadow: 0 0 0 1px rgb(255 255 255 / 90%), 0 2px 12px rgb(25 20 60 / 24%);
    }
    #label {
      position: fixed;
      display: none;
      max-width: min(360px, calc(100vw - 16px));
      overflow: hidden;
      padding: 4px 7px;
      border-radius: 4px;
      background: #211a3d;
      color: #fff;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      text-overflow: ellipsis;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgb(0 0 0 / 22%);
    }
  `;

  const outline = document.createElement("div");
  outline.id = "outline";
  const label = document.createElement("div");
  label.id = "label";
  shadow.append(style, outline, label);
  document.documentElement.append(host);

  function describeElement(element) {
    const id = element.id ? `#${element.id}` : "";
    const classes = Array.from(element.classList)
      .slice(0, 2)
      .map((className) => `.${className}`)
      .join("");
    return `${element.localName}${id}${classes}`;
  }

  function findElement(event) {
    const path = event.composedPath ? event.composedPath() : [event.target];
    return path.find((node) => node instanceof Element && !host.contains(node)) ?? null;
  }

  function drawOutline(element) {
    hoveredElement = element;
    if (!element || !element.isConnected) {
      outline.style.display = "none";
      label.style.display = "none";
      return;
    }

    const rect = element.getBoundingClientRect();
    outline.style.display = "block";
    outline.style.left = `${Math.max(0, rect.left)}px`;
    outline.style.top = `${Math.max(0, rect.top)}px`;
    outline.style.width = `${Math.max(0, Math.min(rect.width, window.innerWidth - Math.max(0, rect.left)))}px`;
    outline.style.height = `${Math.max(0, Math.min(rect.height, window.innerHeight - Math.max(0, rect.top)))}px`;

    label.textContent = describeElement(element);
    label.style.display = "block";
    label.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 368))}px`;
    label.style.top = `${rect.top >= 30 ? rect.top - 26 : Math.min(window.innerHeight - 28, rect.bottom + 5)}px`;
  }

  function onPointerMove(event) {
    drawOutline(findElement(event));
  }

  function removeListeners() {
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize, true);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    removeListeners();
    host.remove();
    if (window[pickerKey]?.cancel === cancel) delete window[pickerKey];
  }

  function cancel() {
    dispose();
  }

  function onClick(event) {
    if (event.button !== 0) return;

    const clickedElement = findElement(event);
    if (!clickedElement) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window[selectionKey] = clickedElement;
    drawOutline(clickedElement);

    let copyPromise;
    try {
      copyPromise = navigator.clipboard.writeText(buildBundle(clickedElement));
    } catch (error) {
      copyPromise = Promise.reject(error);
    }
    dispose();

    Promise.resolve(copyPromise).then(() => {
      delete window[selectionKey];
      showToast("Element context copied", true);
    }).catch((error) => {
      delete window[selectionKey];
      console.warn("Element Lens could not write to the clipboard.", error);
      showToast("Could not copy. Try selecting the element again.", false);
    });
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel();
  }

  function onScroll() {
    if (hoveredElement) drawOutline(hoveredElement);
  }

  function onResize() {
    if (hoveredElement) drawOutline(hoveredElement);
  }

  function shorthand(node) {
    if (!(node instanceof Element)) return "node";
    const id = node.id ? `#${node.id}` : "";
    const classes = Array.from(node.classList).slice(0, 2).map((name) => `.${name}`).join("");
    return `${node.localName}${id}${classes}`;
  }

  function sanitizeShallowElement(node) {
    const sensitiveAttribute = /password|secret|token|authorization|cookie|csrf|session|credential|(?:api|private)[-_]?key/i;
    if (node instanceof HTMLInputElement) {
      node.value = "";
      node.checked = false;
      node.removeAttribute("value");
      node.removeAttribute("checked");
    } else if (node instanceof HTMLSelectElement) {
      node.selectedIndex = -1;
    } else if (node instanceof HTMLOptionElement) {
      node.selected = false;
      node.removeAttribute("selected");
    }
    if (node.matches("button, option")) node.removeAttribute("value");

    Array.from(node.attributes).forEach((attribute) => {
      if (sensitiveAttribute.test(attribute.name)) {
        node.setAttribute(attribute.name, "[redacted]");
      }
    });
  }

  function cloneBounded(node, budget, depth = 0) {
    if (budget.nodes <= 0) return document.createTextNode("… remaining content omitted");

    if (node.nodeType === Node.TEXT_NODE) {
      budget.nodes -= 1;
      const text = node.textContent ?? "";
      return document.createTextNode(text.length > 300 ? `${text.slice(0, 300)}…` : text);
    }
    if (!(node instanceof Element)) return null;

    budget.nodes -= 1;
    const clone = node.cloneNode(false);
    sanitizeShallowElement(clone);

    if (node instanceof HTMLTextAreaElement) return clone;
    if (depth >= budget.maxDepth && node.childNodes.length > 0) {
      clone.append(document.createTextNode("… nested content omitted"));
      return clone;
    }

    for (const child of node.childNodes) {
      if (budget.nodes <= 0) {
        clone.append(document.createTextNode("… remaining content omitted"));
        break;
      }
      const childClone = cloneBounded(child, budget, depth + 1);
      if (childClone) clone.append(childClone);
    }
    return clone;
  }

  function redactMarkup(element) {
    const clone = cloneBounded(element, { nodes: 160, maxDepth: 8 });

    const maxLength = 12000;
    const html = clone.outerHTML;
    return html.length > maxLength
      ? `${html.slice(0, maxLength)}\n<!-- Element Lens: markup truncated -->`
      : html;
  }

  function codeFence(content, language) {
    const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
    const fence = "`".repeat(Math.max(3, longestRun + 1));
    return `${fence}${language}\n${content}\n${fence}`;
  }

  function getComputedStyles(element) {
    const properties = [
      "display", "position", "box-sizing", "width", "height", "min-width", "max-width",
      "min-height", "max-height", "margin-top", "margin-right", "margin-bottom", "margin-left",
      "padding-top", "padding-right", "padding-bottom", "padding-left", "color", "background-color",
      "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-align",
      "text-transform", "border", "border-radius", "box-shadow", "opacity", "overflow",
      "z-index", "flex-direction", "justify-content", "align-items", "gap", "grid-template-columns",
      "object-fit", "transform",
    ];
    const computed = getComputedStyle(element);
    return properties
      .map((property) => [property, computed.getPropertyValue(property).trim()])
      .filter(([, value]) => value)
      .map(([property, value]) => `${property}: ${value};`)
      .join("\n");
  }

  function getNearbyContext(element) {
    const path = [];
    for (let node = element; node instanceof Element && path.length < 6;) {
      path.unshift(shorthand(node));
      const root = node.getRootNode();
      node = root instanceof ShadowRoot ? root.host : node.parentElement;
    }

    const parent = element.parentElement;
    const siblings = parent ? Array.from(parent.children) : [];
    const index = siblings.indexOf(element);
    const nearby = siblings.slice(Math.max(0, index - 1), index + 2).map((node) => {
      const safeCopy = cloneBounded(node, { nodes: 60, maxDepth: 5 });
      const rawText = (safeCopy.textContent ?? "").replace(/\s+/g, " ").trim();
      const text = rawText.length > 140 ? `${rawText.slice(0, 140)}…` : rawText;
      const role = node.getAttribute("role");
      return `- ${shorthand(node)}${role ? ` [role=${JSON.stringify(role)}]` : ""}${text ? ` — ${JSON.stringify(text)}` : ""}`;
    });

    return `Path: ${path.join(" > ")}\nNearby siblings:\n${nearby.join("\n") || "- (none)"}`;
  }

  function getBehaviorClues(element) {
    const relevant = Array.from(element.attributes)
      .filter(({ name }) => name === "role" || name.startsWith("aria-") || name.startsWith("data-") || name.startsWith("on"))
      .map(({ name, value }) => {
        const safeValue = /password|secret|token|authorization|cookie|csrf|session|credential|(?:api|private)[-_]?key/i.test(name)
          ? "[redacted]"
          : value;
        return `${name}=${JSON.stringify(safeValue)}`;
      });
    const clues = [element.localName, ...relevant];
    return `${clues.join("\n")}\nGeneral event-listener code and framework state are not exposed.`;
  }

  function buildBundle(element) {
    return [
      "# Element Lens capture",
      "",
      "## Selected element HTML",
      codeFence(redactMarkup(element), "html"),
      "",
      "## Computed styles",
      codeFence(getComputedStyles(element), "css"),
      "Authored stylesheet rules and source files are not extracted; these are computed style values.",
      "",
      "## Nearby DOM context",
      codeFence(getNearbyContext(element), "text"),
      "",
      "## JavaScript clues",
      codeFence(getBehaviorClues(element), "text"),
      "",
      "Form values are redacted. Review page text and attributes before sharing."
    ].join("\n");
  }

  function showToast(message, success) {
    const toastHost = document.createElement("div");
    toastHost.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;";
    const toastShadow = toastHost.attachShadow({ mode: "closed" });
    const toastStyle = document.createElement("style");
    toastStyle.textContent = `
      :host { all: initial; }
      div {
        position: fixed;
        right: 16px;
        bottom: 16px;
        max-width: min(360px, calc(100vw - 32px));
        padding: 10px 14px;
        border-radius: 8px;
        background: ${success ? "#173d2b" : "#5a2020"};
        color: white;
        font: 600 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 4px 18px rgb(0 0 0 / 24%);
      }
    `;
    const toast = document.createElement("div");
    toast.textContent = message;
    toastShadow.append(toastStyle, toast);
    document.documentElement.append(toastHost);
    window.setTimeout(() => toastHost.remove(), 2600);
  }

  window[pickerKey] = { cancel };
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize, true);
})();
