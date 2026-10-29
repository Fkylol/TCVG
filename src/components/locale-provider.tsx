"use client";

import { createContext, createElement, useContext, useEffect, useRef } from "react";
import type { Locale } from "@/lib/locale-translations";
import { translate } from "@/lib/locale-translations";

const LocaleContext = createContext<Locale>("fr");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const sourceText = useRef(new WeakMap<Text, string>());
  const lastText = useRef(new WeakMap<Text, string>());
  const sourceAttributes = useRef(new WeakMap<Element, Map<string, string>>());
  const lastAttributes = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    document.documentElement.lang = locale;

    const localizeText = (node: Text) => {
      const current = node.nodeValue ?? "";
      const previous = lastText.current.get(node);
      if (!sourceText.current.has(node) || (previous !== undefined && current !== previous)) {
        sourceText.current.set(node, current);
      }
      const source = sourceText.current.get(node) ?? current;
      const leading = source.slice(0, source.length - source.trimStart().length);
      const trailing = source.slice(source.trimEnd().length);
      const content = source.slice(leading.length, source.length - trailing.length);
      if (!content) return;
      const next = `${leading}${translate(content, locale)}${trailing}`;
      lastText.current.set(node, next);
      if (next !== current) node.nodeValue = next;
    };

    const localizeElement = (element: Element) => {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"].includes(element.tagName)) return;
      if (element instanceof HTMLInputElement && ["submit", "button", "reset"].includes(element.type)) {
        const next = translate(element.value, locale);
        if (next !== element.value) element.value = next;
      }
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) localizeText(node as Text);
      const sources = sourceAttributes.current.get(element) ?? new Map<string, string>();
      const applied = lastAttributes.current.get(element) ?? new Map<string, string>();
      for (const name of ["placeholder", "aria-label", "title"]) {
        const current = element.getAttribute(name);
        if (current === null) continue;
        if (!sources.has(name) || (applied.has(name) && current !== applied.get(name))) sources.set(name, current);
        const next = translate(sources.get(name) ?? current, locale);
        applied.set(name, next);
        if (next !== current) element.setAttribute(name, next);
      }
      sourceAttributes.current.set(element, sources);
      lastAttributes.current.set(element, applied);
    };

    localizeElement(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target instanceof Text) localizeText(record.target);
        for (const added of record.addedNodes) {
          if (added instanceof Text) localizeText(added);
          else if (added instanceof Element) localizeElement(added);
        }
        if (record.type === "attributes" && record.target instanceof Element) localizeElement(record.target);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title"],
    });
    return () => observer.disconnect();
  }, [locale]);

  return createElement(LocaleContext.Provider, { value: locale }, children);
}

export function useLocale() {
  const locale = useContext(LocaleContext);
  return { locale, t: (text: string) => translate(text, locale) };
}
